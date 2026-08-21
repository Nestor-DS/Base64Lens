(function () {
  const vscode = acquireVsCodeApi();

  const base64Input = document.getElementById("base64Input");
  const fileTypeSelect = document.getElementById("fileType");
  const previewBtn = document.getElementById("previewBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const clearBtn = document.getElementById("clearBtn");
  const openFileBtn = document.getElementById("openFileBtn");
  const copyBtn = document.getElementById("copyBtn");
  const statusBar = document.getElementById("statusBar");
  const previewSection = document.getElementById("previewSection");
  const previewLabel = document.getElementById("previewLabel");
  const previewBadge = document.getElementById("previewBadge");
  const previewContainer = document.getElementById("previewContainer");

  let currentDataUri = "";
  let currentFileType = "";

  function setStatus(text, type) {
    statusBar.textContent = text;
    statusBar.className = "status" + (type ? " " + type : "");
  }

  function doPreview() {
    var base64 = base64Input.value.trim();
    if (!base64) {
      setStatus("! no base64 content. paste a string or open a file.", "error");
      return;
    }
    setStatus("decoding...", "info");
    previewBtn.disabled = true;
    setTimeout(function () {
      previewBtn.disabled = false;
    }, 300);
    vscode.postMessage({
      command: "preview",
      base64: base64,
      fileType: fileTypeSelect.value,
    });
  }

  previewBtn.addEventListener("click", doPreview);

  openFileBtn.addEventListener("click", function () {
    vscode.postMessage({ command: "requestFile" });
  });

  copyBtn.addEventListener("click", function () {
    var text = base64Input.value.trim();
    if (!text) {
      setStatus("! nothing to copy.", "error");
      return;
    }
    navigator.clipboard.writeText(text).then(
      function () {
        copyBtn.textContent = "copied!";
        copyBtn.classList.add("copied");
        setStatus("base64 copied to clipboard.", "success");
        setTimeout(function () {
          copyBtn.textContent = "copy";
          copyBtn.classList.remove("copied");
        }, 1500);
      },
      function () {
        // Fallback for webview context
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
          copyBtn.textContent = "copied!";
          copyBtn.classList.add("copied");
          setStatus("base64 copied to clipboard.", "success");
          setTimeout(function () {
            copyBtn.textContent = "copy";
            copyBtn.classList.remove("copied");
          }, 1500);
        } catch (e) {
          setStatus(
            "! failed to copy. try manually selecting the text.",
            "error",
          );
        }
        document.body.removeChild(ta);
      },
    );
  });

  downloadBtn.addEventListener("click", function () {
    if (currentDataUri) {
      vscode.postMessage({
        command: "download",
        dataUri: currentDataUri,
        fileType: currentFileType,
      });
    }
  });

  clearBtn.addEventListener("click", function () {
    base64Input.value = "";
    fileTypeSelect.value = "unknown";
    previewSection.style.display = "none";
    previewContainer.innerHTML = "";
    currentDataUri = "";
    currentFileType = "";
    downloadBtn.disabled = true;
    statusBar.textContent = "";
    statusBar.className = "status";
    copyBtn.textContent = "copy";
    copyBtn.classList.remove("copied");
  });

  base64Input.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      doPreview();
    }
  });

  window.addEventListener("message", function (event) {
    var message = event.data;

    switch (message.command) {
      case "setBase64":
        base64Input.value = message.data;
        setStatus(
          "loaded " +
            message.data.length +
            " chars. press [ decode ] or Ctrl+Enter.",
          "success",
        );
        break;

      case "fileLoaded":
        base64Input.value = message.base64;
        fileTypeSelect.value = "unknown";
        setStatus(
          'file "' +
            message.fileName +
            '" loaded (' +
            message.base64.length +
            " chars). decoding...",
          "success",
        );
        break;

      case "showPreview": {
        currentDataUri = message.dataUri;
        currentFileType = message.fileType;
        previewLabel.textContent = message.label;
        previewBadge.textContent = message.mimeType;
        previewContainer.innerHTML = "";

        var fileType = message.fileType;
        var dataUri = message.dataUri;

        try {
          var img = document.createElement("img");
          img.src = dataUri;
          img.alt = message.label;
          img.onerror = function () {
            previewContainer.innerHTML =
              '<div class="error-box">' +
              '<span class="error-icon">!</span>' +
              '<span class="error-text">failed to render image. the base64 data may be corrupted or the format is unsupported.</span>' +
              "</div>";
            setStatus("! render failed. data may be corrupted.", "error");
          };
          previewContainer.appendChild(img);
          previewSection.style.display = "flex";
          previewSection.style.flexDirection = "column";
          downloadBtn.disabled = false;
          setStatus("preview ready.", "success");
        } catch (err) {
          previewContainer.innerHTML =
            '<div class="error-box">' +
            '<span class="error-icon">!</span>' +
            '<span class="error-text">render error: ' +
            String(err) +
            "</span>" +
            "</div>";
          setStatus("! render error: " + String(err), "error");
        }
        break;
      }

      case "showPdfPreview": {
        currentDataUri = message.dataUri;
        currentFileType = message.fileType;
        previewLabel.textContent = message.label;
        previewBadge.textContent = message.mimeType;
        previewContainer.innerHTML = "";

        try {
          if (typeof window.renderPdfToImages === "function") {
            setStatus("rendering pdf...", "info");
            window
              .renderPdfToImages(message.dataUri, 1200, 2)
              .then(function (images) {
                previewContainer.innerHTML = "";
                if (images.length === 0) {
                  previewContainer.innerHTML =
                    '<div class="error-box">' +
                    '<span class="error-icon">!</span>' +
                    '<span class="error-text">pdf has no renderable pages.</span>' +
                    "</div>";
                  setStatus("! pdf has no pages.", "error");
                  return;
                }
                for (var i = 0; i < images.length; i++) {
                  var img = document.createElement("img");
                  img.src = images[i];
                  img.alt = "Page " + (i + 1);
                  img.style.width = "100%";
                  previewContainer.appendChild(img);
                  if (i < images.length - 1) {
                    var sep = document.createElement("div");
                    sep.style.height = "1px";
                    sep.style.background = "var(--border)";
                    sep.style.margin = "8px 0";
                    previewContainer.appendChild(sep);
                  }
                }
                previewSection.style.display = "flex";
                previewSection.style.flexDirection = "column";
                downloadBtn.disabled = false;
                setStatus(
                  "pdf rendered (" +
                    images.length +
                    " page" +
                    (images.length > 1 ? "s" : "") +
                    ").",
                  "success",
                );
              })
              .catch(function (err) {
                previewContainer.innerHTML =
                  '<div class="error-box">' +
                  '<span class="error-icon">!</span>' +
                  '<span class="error-text">failed to render pdf: ' +
                  String(err) +
                  "</span>" +
                  "</div>";
                setStatus("! pdf render failed: " + String(err), "error");
              });
          } else {
            previewContainer.innerHTML =
              '<div class="error-box">' +
              '<span class="error-icon">!</span>' +
              '<span class="error-text">pdf renderer not loaded. try restarting the extension.</span>' +
              "</div>";
            setStatus("! pdf renderer not available.", "error");
          }
        } catch (err) {
          previewContainer.innerHTML =
            '<div class="error-box">' +
            '<span class="error-icon">!</span>' +
            '<span class="error-text">render error: ' +
            String(err) +
            "</span>" +
            "</div>";
          setStatus("! render error: " + String(err), "error");
        }
        break;
      }

      case "showError":
        setStatus("! " + message.data, "error");
        previewSection.style.display = "none";
        downloadBtn.disabled = true;
        break;
    }
  });
})();
