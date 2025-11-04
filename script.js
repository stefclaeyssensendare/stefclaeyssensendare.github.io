const pdfInput = document.getElementById("pdfInput");
const uploadBtn = document.getElementById("uploadBtn");
const loader = document.getElementById("loader");
const resultEl = document.getElementById("result");

async function uploadFile(retries = 2) {
  if (!pdfInput.files.length) {
    resultEl.textContent = "Please select a PDF file first.";
    return;
  }

  const file = pdfInput.files[0];
  const formData = new FormData();
  formData.append("data", file);

  loader.style.display = "block";
  resultEl.textContent = "";

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const controller = new AbortController();
    const timeout = 120000; // 120 seconds
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(
        "https://agent-beta.endare.com/webhook/NN-demo",
        {
          method: "POST",
          body: formData,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Server error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      resultEl.innerHTML = marked.parse(data.output || "");
      loader.style.display = "none";
      return; // Success, exit the function
    } catch (error) {
      clearTimeout(timeoutId);

      console.warn(`Attempt ${attempt} failed: ${error.message || error.name}`);

      if (attempt > retries) {
        // All retries exhausted
        resultEl.textContent =
          error.name === "AbortError"
            ? "Request timed out. Please try again later."
            : "Error: " + (error.message || "Upload failed");
        loader.style.display = "none";
        return;
      }

      // Optional: wait a second before retrying
      await new Promise((res) => setTimeout(res, 1000));
    }
  }
}

uploadBtn.addEventListener("click", () => uploadFile());
