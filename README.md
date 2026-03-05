🚍 TGSRTC Bus Finder (Hyderabad Transit)
An intelligent, full-stack transit routing application designed to help commuters in Hyderabad find the most efficient bus routes. This project implements Direct and Connecting bus search logic using real-world GTFS-inspired data.


🚀 Features

Smart Routing: Prioritizes direct buses and falls back to connecting routes if no direct path exists.
Connection Logic: Implements a "Wait Time" heuristic (3–120 mins) to ensure realistic transfers between buses.
Modern UI: A minimalist, responsive React frontend featuring smooth animations with Framer Motion.
Decoupled Architecture: A robust Spring Boot REST API backend powered by a PostgreSQL database.


🛠️ Tech Stack

Backend: Java 17+, Spring Boot, Maven
Frontend: React (Vite), Tailwind CSS, Framer Motion
Database: PostgreSQL
Data Handling: Python (GTFS data processing)


📂 Project Structure

Plaintext
TGSRTC/
├── src/main/java/      # Spring Boot REST API (Controllers, Services, Models)
├── src/main/resources/ # Database config & GTFS data files
├── tgsrtc-ui/          # React Frontend (Vite project)
└── scripts/            # Python data utility scripts


⚙️ Setup & Installation

1. Database Setup
Ensure PostgreSQL is running on localhost:5432.
Create a database named hyderabad_transit.
Run the provided Python scripts in /scripts to load the bus route data.
2. Backend (Spring Boot)
Open the project in IntelliJ IDEA.
Update src/main/resources/application.properties with your PostgreSQL credentials.
Run Main.java to start the server on http://localhost:8080.
3. Frontend (React)
Navigate to the UI directory: cd tgsrtc-ui
Install dependencies: npm install
Start the development server: npm run dev
Open http://localhost:5173 in your browser.