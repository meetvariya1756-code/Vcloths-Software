# SalesFlow — Multi-Account Product Sales & Label Manager

SalesFlow is a professional sales and package-label management system designed for Indian e-commerce sellers selling across multiple platforms (Meesho, Flipkart, and Amazon) and managing multiple marketplace merchant accounts.

---

## Technical Architecture

- **Frontend:** React + Tailwind CSS (Vite build system)
- **Backend:** Node.js + Express (Prisma ORM for PostgreSQL)
- **PDF Parser Microservice:** Python 3 + Flask + `pdfplumber`
- **Database:** PostgreSQL (with currency precision stored entirely in **Paisa (integer)**)
- **Fuzzy SKU matching:** Levenshtein Distance $\le 2$ matching intelligence in Node.js

---

## Directory Structure

```
salesflow/
├── frontend/          (React app)
├── backend/           (Node + Express)
├── pdf-parser/        (Python microservice)
└── docker-compose.yml
```

---

## Quick Start (Using Docker Compose) - *Recommended*

The entire stack is configured to spin up with a single command using Docker.

### 1. Prerequisite
Make sure you have **Docker** and **Docker Compose** installed on your system.

### 2. Start the Application
From the repository root directory, run:
```bash
docker-compose up --build
```

This will automatically:
1. Boot PostgreSQL on port `5432`
2. Start the Python pdf-parser on port `5001`
3. Spin up the Node.js backend, sync database schemas, and seed default mock values on port `5000`
4. Compile and launch the React dev environment on port `5173`

### 3. Open SalesFlow
Open your web browser and go to:
```
http://localhost:5173
```

- **Default Username:** `admin`
- **Default Password:** `admin123`

---

## Manual Standalone Run (For Local Development)

If you wish to run services standalone without Docker:

### 1. PostgreSQL Database Setup
Ensure PostgreSQL is running on `localhost:5432` and create a database named `salesflow`. Or update `backend/.env` with your correct database connection string:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/salesflow"
```

### 2. Run PDF Parser (Python Microservice)
```bash
cd salesflow/pdf-parser
python -m venv venv
# On Windows
venv\Scripts\activate
# On macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
python app.py
```
*The service will start on `http://localhost:5001`*

### 3. Run Backend (Node.js)
```bash
cd salesflow/backend
npm install
npx prisma db push
node prisma/seed.js
npm run dev
```
*The service will start on `http://localhost:5000`*

### 4. Run Frontend (React)
```bash
cd salesflow/frontend
npm install
npm run dev
```
*The web page will boot on `http://localhost:5173`*

---

## Core Calculations & Business Rules

1. **Labels Calculation:**
   $$\text{labels\_total} = \text{quantity} \times \text{product.labels\_per\_unit}$$
2. **Revenue Calculation:**
   $$\text{revenue} = \text{labels\_total} \times \text{price}$$
   *Note: Price inherits the custom account override price if exists, otherwise uses the base product price.*
3. **Monetary Precision:** All values are saved in **Paisa (integer)** inside PostgreSQL database and converted to Rupee decimals inside React using `Intl.NumberFormat('en-IN')` to display as Indian currency style (e.g. `₹1,02,300`).
