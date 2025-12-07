# Elderly Companion - AI Cognitive Health Tracker

**Bitbucket URL:** [https://github.com/LeonWTW/Elderly-companion]

**Canvas Video Demo:** [https://uoregon.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=e319a101-6381-4b2d-8b24-b3a8012e6764]

---

A web app that helps caregivers track daily cognitive observations of elderly family members and get AI-powered feedback on potential concerns.

## Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Containerization | Docker + Docker Compose | 3.8 (compose file) |
| Backend | Flask (Python) | 3.0.0 |
| Database | MongoDB | 7.0 |
| Frontend | Vanilla JavaScript + AJAX | ES6+ |
| AI Integration | OpenAI API | gpt-3.5-turbo |
| WSGI Server | Gunicorn | 21.2.0 |
| Database Driver | PyMongo | 4.6.1 |

## How to Run Locally

### Prerequisites
- Docker and Docker Compose installed  
- (Optional) OpenAI API key for AI feedback feature  

---

## Environment Variables (.env)

This project uses a `.env` file to store configuration values such as the MongoDB connection string and the optional OpenAI API key.

**Important:**  
This repository includes a **`.env.example`** template that contains the required variable names but **no sensitive values**.

This project runs fully without an OpenAI API key — the AI features will simply display “AI feedback unavailable,” but all core functionality (profile, check-ins, history, UI) is fully operational.


To set up your environment:

```bash
cp .env.example .env
# Then open .env and (optionally) add your OpenAI API key
```

If the `OPENAI_API_KEY` is left blank, the app will still run normally —  
you will simply see “AI feedback unavailable” instead of full AI analysis.

---

## Steps to Run

1. **Clone the repo**
   ```bash
   git clone https://github.com/LeonWTW/Elderly-companion
   cd Elderly-companion
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Add OpenAI API key if you want AI feedback
   ```

3. **Build and run with Docker**
   ```bash
   docker-compose up --build
   ```

4. **Access the app**
   - Visit: `http://localhost:8001`
   - MongoDB is available on port `27017` for debugging

5. **Stop the app**
   ```bash
   docker-compose down
   ```
   Remove DB volume:
   ```bash
   docker-compose down -v
   ```

### Running Without OpenAI API Key
The app works fine without an API key.  
You can still:
- Create a profile  
- Submit daily check-ins  
- Store and view history  

The only missing feature will be AI analysis, which gracefully reports “AI feedback unavailable.”

---

## REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile` | Get elder profile |
| PUT | `/api/profile` | Create/update elder profile |
| GET | `/api/checkins?limit=20` | Get recent check-ins |
| GET | `/api/checkins/<id>` | Get single check-in |
| POST | `/api/checkins` | Create a new check-in + AI analysis |

---

## How to Run Tests

There are no automated tests yet. Manual testing steps:

1. Run `docker-compose up --build`
2. Create a profile
3. Submit a check‑in and verify AI feedback appears (if API key added)
4. Check history list updates correctly
5. Test font size toggle (persists across refreshes)
6. Run without OpenAI API key — app should not crash, just show a fallback message

---

## Project Structure

```
elderly-companion/
├── backend/
│   ├── app.py          # Flask routes
│   ├── db.py           # MongoDB operations
│   ├── ai_client.py    # OpenAI integration
│   └── config.py       # Environment config
├── templates/
│   └── index.html      # Single-page app
├── static/
│   ├── css/styles.css  # Styling
│   └── js/app.js       # Frontend logic
├── docker-compose.yml  # Multi-container setup
├── Dockerfile          # Python app container
├── requirements.txt    # Python dependencies
└── .env.example        # Environment template
```

---

## Questions & Answers

### What is cool about your project?

Honestly, I think the coolest part is that it actually feels useful. My grandma has early-stage dementia and my family struggles to keep track of how she's doing day-to-day. This app lets you quickly log observations (memory, orientation, mood, etc.) and the AI summarizes what’s going on.

It also looks at the last few check-ins to detect trends.  
If memory scores have been going down for several days, it’ll flag “Monitor” or “Concerning” and even give suggestions.

UX-wise, I’m proud of:
- The animated loading overlay for AI processing  
- Font-size toggle that persists across sessions  
- Inline form validation instead of annoying alerts  
- Color‑coded risk badges  
- Clean history timeline  

And the app still works even without an API key — the AI feature simply disables itself without breaking the app.

---

### What AI tool(s) did you use?

I used two main AI tools during development:

#### **1. Claude Opus 4.5 (Anthropic)** — My main coding assistant  
Used for:
- Project structure & architecture  
- Flask routes + MongoDB operations  
- The OpenAI integration logic  
- Frontend JavaScript (AJAX, DOM updates)  
- CSS styling + responsive layout  
- Debugging issues (ObjectId JSON errors, async behavior, etc.)  

Example prompt:
> "Build a Flask endpoint that saves a check-in to MongoDB, fetches the last 5 check-ins, and sends everything to OpenAI for analysis. Return JSON with risk_level, summary, and suggestions."

#### **2. ChatGPT 5.1 (OpenAI)** — Prompt engineering + copywriting  
Used for:
- Refining the AI prompt  
- Score descriptions  
- User‑facing text (tooltips, help text)  

Runtime AI analysis uses **OpenAI gpt‑3.5‑turbo** via API.

---

### What did you learn while building this?

1. **MongoDB + Flask is smoother than expected**  
PyMongo is simple once you understand how documents serialize.

2. **Prompt engineering matters**  
AI gave generic answers until I rewrote the prompt to be structured and include examples.

3. **Error handling is half the job**  
I had to handle failures gracefully, especially when OpenAI timed out.

4. **Docker makes everything reproducible**  
Once the app worked in Docker, it worked everywhere.

5. **Accessibility is not hard if you plan early**  
ARIA labels + keyboard navigation + readable font sizes improved UX a lot.

---

### What were the main technical challenges?

#### **1. MongoDB ObjectId serialization**
Flask can’t serialize ObjectIds by default.  
**Solution:** wrote a helper converting ObjectIds and datetimes to strings.

#### **2. Slow AI response causing UI freeze**
OpenAI calls take 3–10 sec.  
**Solution:** full‑screen loading overlay + fake progress bar + animation.

#### **3. Form validation**
Didn’t want alert() popups.  
**Solution:** inline validation messages that fade in/out.

#### **4. Missing API key**
App shouldn’t crash when no OpenAI key is present.  
**Solution:** ai_client detects missing key and returns fallback response.

#### **5. Date/timezone issues**
Dates shifted when converting to UTC.  
**Solution:** send client‑side timezone + normalize with midday timestamps.

---

## Disclaimer

This app is **NOT** a medical device and cannot diagnose or treat any condition.  
It is meant for personal tracking and informational purposes only.

---

## AI Tools Disclosure

This project was built with assistance from:
- **Claude Opus 4.5** (Anthropic) — code, debugging, structure  
