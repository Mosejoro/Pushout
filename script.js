// API Configuration
const apiKey = "AIzaSyARWEu4Y-VbI8N1AlTWVBIo4ZUD2gPy0Wo";
const sheetId = "1wE0KJlSkhaTFMTcjDj3t_rpp3SOHmn6hrSZeoIwcNzw";
const sheetURL =
  "https://script.google.com/macros/s/AKfycbyvp2YeF59W4dI2L7ck9dsbK1SsKjMDcZhegGibwtZbdljkIRygbYjpOpkAyLvVUaGUqA/exec";

// Helper Functions
function getSheetName(subject, classLevel) {
  return `${subject.replace(/\s+/g, "")}_${classLevel}`;
}

// Fetch and Display Questions
async function fetchQuestions(day, cls, subject) {
  if (!subject) {
    alert("Please select a subject.");
    return;
  }

  console.log("Fetching questions for:", { day, class: cls, subject });

  const sheetName = getSheetName(subject, cls);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}?key=${apiKey}`;

  try {
    console.log("Fetching from URL:", url);
    const response = await fetch(url);
    const data = await response.json();

    if (!data.values) {
      console.error("No values found in response:", data);
      throw new Error(`No sheet found for ${sheetName}`);
    }

    console.log(`Found ${data.values.length} rows of data`);
    displayQuestions(data.values, subject, cls);

    // Start the timer after questions are displayed
    startTimer();
  } catch (error) {
    console.error("Error fetching questions:", error);
    document.getElementById("questions").innerHTML = `
      <p class="error"> ${subject.replace(
        /_/g,
        " "
      )} - ${cls} is not yet available.</p>
      <p class="error">Please make sure you've selected the right Class, Subject and Day.</p>
      <button onclick="window.location.href='index.html'" class="sub-btn">Go Back</button>
    `;
  }
}

// Store questions data globally
let questionsData = [];

// Display questions in HTML
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function displayQuestions(data, subject, cls) {
  const questionsDiv = document.getElementById("questions");
  questionsDiv.innerHTML = "";
  questionsData = [];

  if (!data || data.length <= 1) {
    questionsDiv.innerHTML = "<p>No questions found.</p>";
    return;
  }
  // Separate header row and question rows
  const headerRow = data[0];
  const questionRows = data.slice(1);

  // Shuffle only the question rows, keeping the header row intact
  const shuffledQuestionRows = shuffleArray(questionRows);

  // Limit to 20 questions or less if there aren't enough questions
  const limitedQuestionRows = shuffledQuestionRows.slice(0, 20);

  // Get username from localStorage
  const userName = localStorage.getItem("userName") || "Student";

  // Add exam metadata section
  questionsDiv.innerHTML = `
       <div class="exam-header">
      <h3>Subject: ${subject.replace(/_/g, " ")}</h3>
      <h4>Class: Primary ${cls.substring(1)}</h4>
      <h3>Student: ${userName}</h3>
      <h3 class="Warn">Do well to answer all the questions before the time runs out.</h3>
    </div>
  `;

  // Create questions
  for (let i = 0; i < limitedQuestionRows.length; i++) {
    const row = limitedQuestionRows[i];
    const questionText = row[0];
    const options = {
      A: row[1],
      B: row[2],
      C: row[3],
      D: row[4],
      E: row[5],
    };
    const correctAnswer = row[6];

    // Shuffle the options while maintaining the correct mapping
    const optionKeys = ["A", "B", "C", "D", "E"];
    const shuffledOptionKeys = shuffleArray([...optionKeys]);

    // Create shuffled options object
    const shuffledOptions = {};
    shuffledOptionKeys.forEach((newKey, index) => {
      shuffledOptions[newKey] = options[optionKeys[index]];
    });

    // Find the new key for the correct answer
    const newCorrectAnswerKey =
      shuffledOptionKeys[optionKeys.indexOf(correctAnswer)];

    // Process the question text to extract and handle image URLs
    const { processedText, imageHtmlContent } = processQuestionImages(
      questionText,
      i
    );

    questionsData.push({
      questionNumber: i + 1,
      questionText: processedText,
      options: shuffledOptions,
      correctAnswer: newCorrectAnswerKey,
      subject,
      cls,
    });

    const questionHTML = `
      <div class="question-container">
        <p class="question-text"><strong>Question ${
          i + 1
        }:</strong> ${processedText}</p>
        ${imageHtmlContent}
        <div class="options-container">
          ${Object.entries(shuffledOptions)
            .map(
              ([key, value]) => `
            <label class="option-label">
              <input type="radio" name="q${i + 1}" value="${key}" required> 
              ${value}
            </label>
          `
            )
            .join("")}
        </div>
      </div>
  `;

    questionsDiv.innerHTML += questionHTML;
  }

  // Add submit button
  questionsDiv.innerHTML += `
    <button onclick="checkAnswers()" class="submit-btn">Submit Exam</button>
  `;

  // Add this line to set up the listeners for removing the "unanswered" class
  addRadioChangeListeners();

  // Setup image error handling
  setupImageErrorHandling();
}

// Helper function to process question images - handles both regular and Google Drive images
function processQuestionImages(questionText, questionNumber) {
  let processedText = questionText;
  let imageHtmlContent = "";

  // Regular expression for standard image URLs
  const standardImageRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/gi;

  // Regular expression for Google Drive links
  const googleDriveRegex =
    /(https?:\/\/drive\.google\.com\/file\/d\/([^/\s]+)\/view[^\s]*|https?:\/\/drive\.google\.com\/open\?id=([^\s&]+))/gi;

  // First check for Google Drive links
  const driveMatches = [...questionText.matchAll(googleDriveRegex)];

  if (driveMatches && driveMatches.length > 0) {
    for (const match of driveMatches) {
      const fullUrl = match[0];
      // Extract fileId from the URL - either from /d/FILEID/view or ?id=FILEID
      const fileId = match[2] || match[3];

      if (fileId) {
        // Create a direct link for the image
        // This format allows direct image embedding from Google Drive
        const directImageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

        // Replace the Google Drive URL in the question text
        processedText = processedText.replace(fullUrl, "");

        // Create image HTML
        imageHtmlContent += `<div class="question-image-container">
          <img src="${directImageUrl}" alt="Question ${questionNumber} image" class="question-image" data-source="google-drive">
        </div>`;
      }
    }
  }
  // If no Google Drive links, check for standard image URLs
  else {
    const standardMatches = [...questionText.matchAll(standardImageRegex)];

    if (standardMatches && standardMatches.length > 0) {
      for (const match of standardMatches) {
        const imageUrl = match[0];

        // Replace the URL in the question text
        processedText = processedText.replace(imageUrl, "");

        // Create image HTML
        imageHtmlContent += `<div class="question-image-container">
          <img src="${imageUrl}" alt="Question ${questionNumber} image" class="question-image">
        </div>`;
      }
    }
  }

  return { processedText, imageHtmlContent };
}

// Function to handle image loading errors
function setupImageErrorHandling() {
  document.querySelectorAll(".question-image").forEach((img) => {
    img.onerror = function () {
      this.onerror = null;

      // Custom message for Google Drive images
      const errorMessage =
        this.dataset.source === "google-drive"
          ? "Google Drive image could not be loaded. Make sure the file is publicly accessible."
          : "Image could not be loaded";

      this.parentNode.innerHTML = `
        <div class="image-error">
          <p>${errorMessage}</p>
          <small>${this.src}</small>
        </div>
      `;
    };
  });
}

// Check answers and calculate score
// Function to check answers with validation for unanswered questions
function checkAnswers() {
  // Get the submit button
  const submitBtn = document.querySelector(".submit-btn");

  // Display loading state
  submitBtn.innerHTML = '<span class="spinner"></span> Submitting...';
  submitBtn.disabled = true;

  // Clear the timer interval if it exists
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  // Get username from localStorage instead of form inputs
  const username = localStorage.getItem("userName") || "Unknown Student";

  // Proceed with calculating score and submitting
  let score = 0;
  const responses = [];
  const totalQuestions = questionsData.length;

  questionsData.forEach((q, index) => {
    const selected = document.querySelector(
      `input[name="q${index + 1}"]:checked`
    );
    const isCorrect = selected && selected.value === q.correctAnswer;
    if (isCorrect) score++;

    responses.push({
      questionNumber: index + 1,
      questionText: q.questionText || `Question ${index + 1}`,
      options: q.options || {},
      selectedAnswer: selected ? selected.value : null,
      correctAnswer: q.correctAnswer,
      correct: isCorrect,
    });
  });

  // Prepare result data
  const resultData = {
    timestamp: new Date().toISOString(),
    name: username,
    subject:
      localStorage.getItem("examSubject") ||
      document.getElementById("subject").value,
    class:
      localStorage.getItem("examClass") ||
      document.getElementById("class").value,
    score: score,
    totalQuestions: totalQuestions,
    percentage: ((score / totalQuestions) * 100).toFixed(1),
    responses: responses,
  };

  // Save to appropriate sheet
  saveResult(resultData);
}

// Save result to Google Sheets
async function saveResult(resultData) {
  try {
    // Create a copy of resultData with stringified responses for the API
    const apiData = {
      ...resultData,
      responses: JSON.stringify(resultData.responses),
    };

    const response = await fetch(sheetURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `data=${encodeURIComponent(
        JSON.stringify({
          ...apiData,
          sheetName: getSheetName(resultData.subject, resultData.class),
        })
      )}`,
    });

    // Check response status
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Add a small delay to ensure data is saved
    await new Promise((resolve) => setTimeout(resolve, 1000));

    displayResults(resultData);
  } catch (error) {
    console.error("Error saving result:", error);
    alert(
      "There was an issue displaying the results, but your answers have been recorded successfully."
    );
  }
}

// Display final results
function displayResults(resultData) {
  const questionsDiv = document.getElementById("questions");

  // Calculate grade based on percentage
  const percentage = Number.parseFloat(resultData.percentage);
  let grade, gradeColor;

  if (percentage >= 81) {
    grade = "A+";
    gradeColor = "var(--success-green)";
  } else if (percentage >= 71) {
    grade = "A";
    gradeColor = "var(--success-greena)";
  } else if (percentage >= 66) {
    grade = "B+";
    gradeColor = "#4caf50";
  } else if (percentage >= 61) {
    grade = "B";
    gradeColor = "#8bc34a";
  } else if (percentage >= 56) {
    grade = "C+";
    gradeColor = "#cddc39";
  } else if (percentage >= 51) {
    grade = "C";
    gradeColor = "#ffeb3b";
  } else if (percentage >= 46) {
    grade = "D+";
    gradeColor = "#ffc107";
  } else if (percentage >= 41) {
    grade = "D";
    gradeColor = "#ff9800";
  } else if (percentage >= 36) {
    grade = "E+";
    gradeColor = "#ff5722";
  } else if (percentage >= 31) {
    grade = "E";
    gradeColor = "#f44336";
  } else {
    grade = "F";
    gradeColor = "var(--error-red)";
  }

  // Store responses in localStorage for review page
  localStorage.setItem("examResponses", JSON.stringify(resultData.responses));
  localStorage.setItem("examSubjectResult", resultData.subject);
  localStorage.setItem("examClassResult", resultData.class);

  questionsDiv.innerHTML = `
    <div class="results-container">
      <h2><strong>${resultData.name}</strong>, Well done on your exam!</h2>
      <div class="results-summary">
        <p>Keep going, you're doing great! Just take it one step at a time.</p>
        <div class="score-display">
        <h3 class="Grade"><span style="color: ${gradeColor};   text-shadow:${gradeColor} 2px 2px 5px;
font-weight: bold;">${grade}</span></h3>
          <h3>Your Score: <span>${resultData.score}/${resultData.totalQuestions}</span></h3>
          <h3>Percentage: <span>${resultData.percentage}%</span></h3>
        </div>
      </div>
      <div class="results-actions">
        <button onclick="window.location.href='review.html'" class="review-btn">Review Incorrect Answers</button>
        <button onclick="window.location.href='index.html'" class="submit-btn">Take Another Exam</button>
      </div>
    </div>
  `;

  // Clear the stored exam details
  localStorage.removeItem("examDay");
  localStorage.removeItem("examClass");
  localStorage.removeItem("examSubject");

  // Make sure timer is stopped
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Timer functionality
const examDuration = 30 * 60; // 30 minutes in seconds
let timerInterval;

// Update the timer's time-up handler to ensure it properly submits
function startTimer() {
  const timerElement = document.getElementById("time-remaining");
  let timeLeft = examDuration;

  // Update timer immediately
  updateTimerDisplay(timeLeft);

  timerInterval = setInterval(() => {
    timeLeft--;

    // Update the timer display
    updateTimerDisplay(timeLeft);

    // Update progress bar
    const progressPercent = 100 - (timeLeft / examDuration) * 100;
    document.querySelector(
      ".progress-bar-fill"
    ).style.width = `${progressPercent}%`;

    // When time runs out
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      alert("Time's up! Your exam will be submitted now.");
      checkAnswers(); // This will now work even with unanswered questions
    }

    // Warning when 5 minutes remaining
    if (timeLeft === 600) {
      showTimerWarning("10 Minutes Remaining!");
    }
    if (timeLeft === 300) {
      showTimerWarning("5 minutes remaining!");
    }
  }, 1000);
}

function updateTimerDisplay(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  document.getElementById("time-remaining").textContent = `${minutes
    .toString()
    .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;

  // Change color when less than 10 minutes remaining
  if (seconds < 600) {
    document.getElementById("time-remaining").style.color = "orange";
  }
  // Change color when less than 5 minutes remaining
  if (seconds < 300) {
    document.getElementById("time-remaining").style.color = "#ef4444";
  }
}

function showTimerWarning() {
  // Create a warning toast
  const toast = document.createElement("div");
  toast.className = "toast toast-warning";
  toast.innerHTML = "Time is Ticking!!!";
  document.body.appendChild(toast);

  // Remove toast after 5 seconds
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// Add this to clear timer when exam is submitted
function addRadioChangeListeners() {
  document.querySelectorAll('input[type="radio"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      // Find the question container
      const questionContainer = e.target.closest(".question-container");
      if (questionContainer) {
        questionContainer.classList.remove("unanswered");
      }
    });
  });
}
