
document.addEventListener("DOMContentLoaded", function () {

    const chatMessages = document.getElementById("chatMessages");
    const userInput = document.getElementById("userInput");
    const sendButton = document.getElementById("sendButton");
    const clearButton = document.getElementById("clearButton");

    if (!chatMessages || !userInput || !sendButton || !clearButton) {
        console.error("LaptopGPT: Required HTML elements were not found.");
        return;
    }

    let conversation = [];

    const blueColors = [
        "#073B78",
        "#0756A9",
        "#0877E8",
        "#168CFF",
        "#00AAFF",
        "#75D5FF"
    ];

    // Load an external JavaScript library
    function loadLibrary(url, globalName) {
        return new Promise((resolve, reject) => {

            if (window[globalName]) {
                resolve();
                return;
            }

            const script = document.createElement("script");
            script.src = url;

            script.onload = resolve;
            script.onerror = () => reject(
                new Error(globalName + " library could not load.")
            );

            document.head.appendChild(script);
        });
    }

    function loadMarkdown() {
        return loadLibrary(
            "https://cdn.jsdelivr.net/npm/marked/marked.min.js",
            "marked"
        );
    }

    function loadChartJS() {
        return loadLibrary(
            "https://cdn.jsdelivr.net/npm/chart.js",
            "Chart"
        );
    }

    // Display a chart inside a chatbot message
    async function addChart(container, chartData) {

        if (!chartData) return;

        try {
            await loadChartJS();

            const chartContainer = document.createElement("div");
            chartContainer.className = "chart-container";
            chartContainer.style.width = "100%";
            chartContainer.style.maxWidth = "650px";
            chartContainer.style.height = "350px";
            chartContainer.style.marginTop = "20px";
            chartContainer.style.position = "relative";

            const canvas = document.createElement("canvas");
            chartContainer.appendChild(canvas);
            container.appendChild(chartContainer);

            const type = chartData.type;
            const datasets = chartData.datasets || [];

            const chartDatasets = datasets.map((dataset, index) => {

                const colors = blueColors;

                return {
                    label: dataset.label || "Data",
                    data: dataset.data,

                    backgroundColor:
                        type === "pie" || type === "doughnut"
                            ? colors
                            : colors[index % colors.length],

                    borderColor:
                        type === "pie" || type === "doughnut"
                            ? "#050810"
                            : colors[(index + 2) % colors.length],

                    borderWidth: 2,
                    borderRadius: type === "bar" ? 6 : 0,

                    tension: 0.35,
                    fill: false
                };
            });

            const isCircular =
                type === "pie" || type === "doughnut";

            new Chart(canvas, {
                type: type,

                data: {
                    labels: chartData.labels,
                    datasets: chartDatasets
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,

                    plugins: {
                        title: {
                            display: true,
                            text: chartData.title || "Laptop Data",
                            color: "#75D5FF",
                            font: {
                                size: 17,
                                weight: "bold"
                            }
                        },

                        legend: {
                            display: true,
                            labels: {
                                color: "#DCEBFF"
                            }
                        }
                    },

                    scales: isCircular ? {} : {
                        x: {
                            ticks: {
                                color: "#DCEBFF"
                            },
                            grid: {
                                color: "rgba(100, 160, 255, 0.12)"
                            }
                        },

                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: "#DCEBFF"
                            },
                            grid: {
                                color: "rgba(100, 160, 255, 0.12)"
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error("Chart error:", error);

            const errorText = document.createElement("p");
            errorText.textContent = "Unable to display this chart.";
            container.appendChild(errorText);
        }
    }

    // Display formatted messages
    async function addMessage(message, sender, chartData = null) {

        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message");

        messageDiv.classList.add(
            sender === "user" ? "user-message" : "bot-message"
        );

        const name = document.createElement("strong");
        name.textContent = sender === "user" ? "You" : "LaptopGPT";

        const text = document.createElement("div");
        text.classList.add("message-content");

        if (sender === "bot") {

            try {
                await loadMarkdown();

                const cleanedMessage = message.replace(
                    /\\(?=[#*_])/g,
                    ""
                );

                const safeMessage = cleanedMessage.replace(
                    /[&<>"]/g,
                    character => ({
                        "&": "&amp;",
                        "<": "&lt;",
                        ">": "&gt;",
                        '"': "&quot;"
                    })[character]
                );

                text.innerHTML = window.marked.parse(safeMessage, {
                    gfm: true,
                    breaks: true
                });

            } catch (error) {
                console.error("Markdown formatting error:", error);
                text.textContent = message;
            }

        } else {
            text.textContent = message;
        }

        messageDiv.appendChild(name);
        messageDiv.appendChild(text);
        chatMessages.appendChild(messageDiv);

        if (sender === "bot" && chartData) {
            await addChart(messageDiv, chartData);
        }

        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Send message to Flask
    async function sendMessage() {

        const message = userInput.value.trim();

        if (!message) {
            alert("Please type a question first!");
            return;
        }

        await addMessage(message, "user");

        conversation.push({
            sender: "user",
            text: message
        });

        userInput.value = "";

        sendButton.disabled = true;
        sendButton.textContent = "Thinking...";

        try {

            const response = await fetch("/api/chat", {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    message: message,
                    history: conversation
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.reply || "Server error");
            }

            const botReply = data.reply || "No response received.";

            await addMessage(botReply, "bot", data.chart);

            conversation.push({
                sender: "bot",
                text: botReply
            });

        } catch (error) {

            console.error("LaptopGPT error:", error);

            await addMessage(
                "Sorry, something went wrong. Please try again.",
                "bot"
            );

        } finally {

            sendButton.disabled = false;
            sendButton.textContent = "Send ➤";
            userInput.focus();

        }
    }

    // Clear conversation
    clearButton.addEventListener("click", function () {

        chatMessages.innerHTML = "";
        conversation = [];
        userInput.value = "";
        userInput.focus();

    });

    sendButton.addEventListener("click", sendMessage);

    userInput.addEventListener("keydown", function (event) {

        if (event.key === "Enter") {
            event.preventDefault();
            sendMessage();
        }

    });

    console.log("LaptopGPT JavaScript loaded successfully!");

});
