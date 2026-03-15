"use strict";

let inputText,
  outputText,
  translateBtn,
  sourceLang,
  targetLang,
  swapBtn,
  charCount,
  copyOutputBtn,
  listenInputBtn,
  listenOutputBtn,
  speechToTextBtn,
  themeToggle;

let liveTranslate = null;
let liveTranslateAbortController = null;

function mapSpeechLang(code) {
  switch (code) {
    case "en":
      return "en-US";
    case "es":
      return "es-ES";
    case "fr":
      return "fr-FR";
    case "de":
      return "de-DE";
    case "it":
      return "it-IT";
    case "pt":
      return "pt-PT";
    case "ru":
      return "ru-RU";
    case "zh":
      return "zh-CN";
    case "ja":
      return "ja-JP";
    case "ko":
      return "ko-KR";
    default:
      return "en-US";
  }
}

function speakText(text, langCode) {
  const trimmed = (text || "").trim();
  if (!trimmed) return;

  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    typeof window.SpeechSynthesisUtterance === "undefined"
  ) {
    alert("Text-to-speech is not supported in this browser.");
    return;
  }

  const synth = window.speechSynthesis;

  if (synth.speaking) {
    synth.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.lang = mapSpeechLang(langCode);

  utterance.onerror = (e) => {
    console.error("Speech synthesis error:", e);
  };

  try {
    synth.speak(utterance);
  } catch (e) {
    console.error("Speech synthesis invocation failed:", e);
  }
}

function debounce(fn, ms) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(null, args), ms);
  };
}

async function translateText(options = {}) {
  const { showButtonLoading = true } = options;
  const text = inputText.value.trim();

  if (!text) {
    outputText.value = "";
    outputText.placeholder = "Translation will appear here...";
    if (showButtonLoading) {
      translateBtn.disabled = false;
      translateBtn.textContent = "Translate";
    }
    return;
  }

  const src = sourceLang.value;
  const tgt = targetLang.value;
  const requestedText = text;

  const fetchOptions = {};

  if (!showButtonLoading && typeof AbortController !== "undefined") {
    if (liveTranslateAbortController) {
      liveTranslateAbortController.abort();
    }
    liveTranslateAbortController = new AbortController();
    fetchOptions.signal = liveTranslateAbortController.signal;
  }

  const onError = (err) => {
    if (err?.name === "AbortError") return;
    if (inputText.value.trim() !== requestedText) return;

    console.error("Translation error:", err);
    outputText.value =
      "Translation failed. Please check your connection and try again.";
    outputText.placeholder = "Translation will appear here...";
  };

  const onFinally = () => {
    if (showButtonLoading) {
      translateBtn.disabled = false;
      translateBtn.textContent = "Translate";
    } else if (inputText.value.trim() === requestedText) {
      outputText.placeholder = "Translation will appear here...";
    }
  };

  if (showButtonLoading) {
    translateBtn.disabled = true;
    translateBtn.textContent = "Translating...";
    outputText.value = "";
  } else {
    outputText.placeholder = "Translating...";
  }

  try {
    const lingvaSrc = src === "auto" ? "auto" : src;
    const lingvaUrl = `https://lingva.thedaviddelta.com/api/v1/${lingvaSrc}/${tgt}/${encodeURIComponent(
      text
    )}`;

    const res = await fetch(lingvaUrl, fetchOptions);

    if (!res.ok) {
      throw new Error(`Lingva failed with status ${res.status}`);
    }

    const data = await res.json();
    const result = data.translation || data.translatedText;

    if (typeof result === "string" && result.trim()) {
      if (inputText.value.trim() === requestedText) {
        outputText.value = result;
        outputText.placeholder = "Translation will appear here...";
      }
      onFinally();
      return;
    }

    throw new Error("Lingva returned no translation string");
  } catch (primaryErr) {
    console.warn("Lingva failed, falling back to MyMemory:", primaryErr);

    try {
      const srcForPair = src === "auto" ? "en" : src;
      const langpair = `${srcForPair}|${tgt}`;
      const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        text
      )}&langpair=${langpair}`;

      const res = await fetch(myMemoryUrl, fetchOptions);
      const data = await res.json();

      if (
        data.responseStatus === 200 &&
        data.responseData &&
        typeof data.responseData.translatedText === "string"
      ) {
        if (inputText.value.trim() === requestedText) {
          outputText.value = data.responseData.translatedText;
          outputText.placeholder = "Translation will appear here...";
        }
      } else {
        if (inputText.value.trim() === requestedText) {
          outputText.value = "Translation failed. Please try again.";
          outputText.placeholder = "Translation will appear here...";
        }
      }
    } catch (fallbackErr) {
      onError(fallbackErr);
    }

    onFinally();
  }
}

function startSpeechToText() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Speech recognition is not supported in this browser.");
    return;
  }

  const recognition = new SpeechRecognition();
  const srcCode = sourceLang.value === "auto" ? "en" : sourceLang.value;
  recognition.lang = mapSpeechLang(srcCode);
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  if (speechToTextBtn) {
    speechToTextBtn.classList.add("recording");
  }

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    inputText.value = transcript;

    if (charCount) {
      charCount.textContent = `${inputText.value.length} / 500`;
    }

    liveTranslate();
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
  };

  recognition.onend = () => {
    if (speechToTextBtn) {
      speechToTextBtn.classList.remove("recording");
    }
  };

  recognition.start();
}

function init() {
  inputText = document.getElementById("inputText");
  outputText = document.getElementById("outputText");
  translateBtn = document.getElementById("translateBtn");
  sourceLang = document.getElementById("sourceLang");
  targetLang = document.getElementById("targetLang");
  swapBtn = document.getElementById("swapBtn");
  charCount = document.getElementById("charCount");
  copyOutputBtn = document.getElementById("copyOutputBtn");
  listenInputBtn = document.getElementById("listenInputBtn");
  listenOutputBtn = document.getElementById("listenOutputBtn");
  speechToTextBtn = document.getElementById("speechToTextBtn");
  themeToggle = document.getElementById("themeToggle");

  if (!inputText || !outputText || !translateBtn) {
    console.error("QuickTranslate: missing required elements");
    return;
  }

  if (charCount) {
    charCount.textContent = `${inputText.value.length} / 500`;
  }

  const savedTheme = window.localStorage.getItem("quickTranslateTheme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
  }

  liveTranslate = debounce(() => translateText({ showButtonLoading: false }), 400);

  translateBtn.addEventListener("click", () =>
    translateText({ showButtonLoading: true })
  );

  translateText({ showButtonLoading: true });

  inputText.addEventListener("input", () => {
    if (charCount) {
      charCount.textContent = `${inputText.value.length} / 500`;
    }

    const text = inputText.value.trim();
    if (!text) {
      outputText.value = "";
      outputText.placeholder = "Translation will appear here...";
      return;
    }

    liveTranslate();
  });

  swapBtn?.addEventListener("click", () => {
    const temp = sourceLang.value;
    sourceLang.value = targetLang.value;
    targetLang.value = temp;

    if (inputText.value.trim()) liveTranslate();
  });

  sourceLang?.addEventListener("change", () => {
    if (inputText.value.trim()) liveTranslate();
  });

  targetLang?.addEventListener("change", () => {
    if (inputText.value.trim()) liveTranslate();
  });

  copyOutputBtn?.addEventListener("click", async () => {
    const text = outputText.value.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error("Clipboard copy failed:", e);
    }
  });

  listenInputBtn?.addEventListener("click", () => {
    const srcCode = sourceLang.value === "auto" ? "en" : sourceLang.value;
    speakText(inputText.value, srcCode);
  });

  listenOutputBtn?.addEventListener("click", () => {
    speakText(outputText.value, targetLang.value);
  });

  speechToTextBtn?.addEventListener("click", startSpeechToText);

  themeToggle?.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const mode = document.body.classList.contains("dark") ? "dark" : "light";
    window.localStorage.setItem("quickTranslateTheme", mode);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}