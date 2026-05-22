# Stress Monitoring Application — Project Overview

## Tech Stack

### Frontend
- Angular

### Backend
- Java REST API

### Database
- PostgreSQL

### Machine Learning
- Python
- Used for stress prediction/classification based on biometric sensor values

---

# Database Structure

## users

Stores user account and profile information.

Fields:
- id
- created_at
- password
- username
- email
- age
- avatar_url
- gender
- height
- name
- weight

Purpose:
- authentication
- profile management
- linking users to sessions and sensor data

---

## sessions

Stores monitoring sessions for users.

Fields:
- id
- end_time
- label
- mode
- start_time
- user_id

Purpose:
- represents a monitoring session
- groups multiple sensor readings together

Possible labels:
- -1 - unknown
- 0 - relaxed
- 1 - stressed

---

## sensor_readings

Stores raw biometric sensor readings.

Fields:
- id
- bpm
- finger
- gsr
- ibi
- label
- temp
- timestamp
- session_id
- user_id

Purpose:
- main source of truth for analytics
- used for live monitoring
- used for trends/statistics
- used for ML predictions

Sensor data includes:
- BPM (heart rate)
- GSR (galvanic skin response)
- IBI (inter-beat interval)
- temperature
- stress label

---

# API Endpoints

## Authentication

### POST /api/auth/register
Creates a new user account.

### POST /api/auth/login
Authenticates user and returns basic user data.

---

## User Profile

### GET /api/user/{userId}
Returns user profile information.

### PUT /api/user/{userId}/profile
Updates user profile data.

### POST /api/user/{userId}/avatar
Updates user avatar URL.

---

## Sensor Data

### POST /api/sensor/save
Saves biometric sensor readings.

Stores:
- bpm
- ibi
- gsr
- temperature
- finger detection
- stress label
- session reference
- user reference

### GET /api/sensor/all
Returns all sensor readings.

### GET /api/sensor/export
Exports sensor readings as CSV.

---

## Sessions

### POST /api/sensor/sesiune/start
Starts a monitoring session and enables recording.

Parameters:
- label
- userId

### POST /api/sensor/sesiune/stop
Stops monitoring session and recording.

Parameters:
- sessionId

---

## Machine Learning

### POST /api/sensor/predict/stress
Sends sensor values to Python ML service and returns stress prediction.

Input features:
- bpm
- ibi
- gsr
- temp

Python ML endpoint:
- localhost:5000/predict

---

## Analytics

### GET /api/stress/trends/weekly
Returns weekly stress trends grouped by weekdays.

Includes:
- day name
- stress level
- stress event status

### GET /api/stress/stats
Returns stress analytics and statistics.

Includes:
- average stress
- peak stress
- stress events
- recovery time
- weekly comparison

# DTOs

## ProfileUpdateRequest

Purpose:
- used for updating user profile information

Fields:
- name
- email
- age
- weight
- height
- gender

Used in:
- profile update endpoint

---

## StressStatsDto

Purpose:
- used for stress analytics/statistics response

Fields:
- avgStress
- avgChangePercent
- peakStress
- peakDay
- peakTime
- stressEvents
- eventsChange
- recoveryTimeHours
- recoveryImprovement

Used in:
- /api/stress/stats

Contains:
- weekly stress statistics
- comparisons with previous week
- recovery metrics

---

## WeeklyTrendDto

Purpose:
- used for weekly trends chart data

Fields:
- day
- stressLevel
- hasEvent

Used in:
- /api/stress/trends/weekly

Contains:
- weekday label
- average stress level
- stress event indicator

# Models

## User
Fields:
- id
- username
- email
- password
- createdAt
- name
- age
- weight
- height
- gender
- avatarUrl

Purpose:
- user authentication and profile data

---

## Session
Fields:
- id
- user
- mode
- label
- startTime
- endTime

Purpose:
- monitoring sessions

---

## SensorReading
Fields:
- id
- timestamp
- bpm
- ibi
- gsr
- temp
- finger
- label
- user
- session

Purpose:
- biometric sensor readings
- main analytics source

---

## DailyStressSummary
Fields:
- id
- user
- date
- avgStressLevel
- peakStressLevel
- peakTime
- stressEventCount
- totalRecoveryMinutes

Purpose:
- aggregated daily analytics

Current state:
- exists but currently empty

---

## SensorReadingRequest
Fields:
- bpm
- ibi
- gsr
- temp
- finger
- label
- userId
- sessionId

Purpose:
- request body for sensor data saving

---

## LoginRequest
Fields:
- username
- password

Purpose:
- login request body

---

## RegisterRequest
Fields:
- username
- email
- password

Purpose:
- registration request body

# Repositories

## UserRepository

Methods:
- findByUsername()
- findByEmail()

Purpose:
- user lookup
- authentication
- duplicate validation

---

## SessionRepository

Methods:
- findByUserId()

Purpose:
- session retrieval by user

---

## SensorReadingRepository

Methods:
- findByUserAndTimestampBetween()
- findWeeklyAvgStress()

Purpose:
- sensor data queries
- weekly stress analytics
- date-based filtering

Custom query:
- calculates average stress grouped by day

---

## DailyStressSummaryRepository

Methods:
- findByUserAndDate()
- findByUserAndDateBetweenOrderByDateAsc()

Purpose:
- aggregated daily analytics
- weekly trend retrieval
- daily statistics queries

# Services Layer

## UserService

Purpose:
- handles authentication and user profile logic

Main methods:

### register(username, email, password)
- creates a new user
- validates duplicate username/email
- saves user in database

### login(username, password)
- validates credentials
- returns authenticated user

### getUserById(userId)
- retrieves user profile by id

### updateProfile(userId, request)
- updates profile information:
  - name
  - email
  - age
  - weight
  - height
  - gender

### findById(id)
- retrieves user entity

### save(user)
- saves updated user data

---

## SessionService

Purpose:
- handles monitoring sessions

Main methods:

### startSession(user, mode, label)
- creates a monitoring session
- stores:
  - mode
  - label
  - start time

### stopSession(sessionId)
- closes monitoring session
- stores end time

### getSessionsByUser(userId)
- returns all sessions for a user

### getSessionById(sessionId)
- retrieves session entity

---

## SensorService

Purpose:
- manages sensor readings

Main methods:

### save(reading)
- stores sensor reading
- automatically adds timestamp

### getAll()
- returns all sensor readings

Stored data:
- BPM
- IBI
- GSR
- temperature
- finger detection
- stress label

---

## StressAggregationService

Purpose:
- calculates stress analytics
- generates daily statistics

Main methods:

### computeStressLevel(reading)
- calculates stress score using:
  - BPM
  - GSR
- returns value between 0 and 100

### updateForReading(reading)
- updates daily analytics after new sensor reading
- updates:
  - average stress
  - peak stress
  - peak time

### recalcDailyStats(summary, date)
- recalculates full daily statistics
- processes all readings from a day

Calculates:
- average stress
- peak stress
- stress events
- recovery duration

Stress event logic:
- stress > 70 → stress event starts
- stress <= 45 → recovery detected

Used repositories:
- SensorReadingRepository
- DailyStressSummaryRepository

Current state:
- aggregation logic implemented
- daily summaries partially integrated

# WebSocket Integration – Arduino Sensor Communication

## ArduinoWebSocketClient

Component responsible for real-time communication between the Arduino device and the Spring Boot backend using WebSocket.

### Main Responsibilities

- Connects automatically to the Arduino WebSocket server
- Receives live sensor data continuously
- Parses incoming JSON messages
- Validates sensor readings
- Maintains temporary sliding windows for filtering/statistics
- Handles automatic reconnection if connection is lost
- Stores current recording/session state globally

---

# WebSocket Connection

## Arduino WebSocket URL

```java
ws://172.20.10.10:81

# Frontend Services

## AuthService

Handles authentication, session persistence and theme management.

### Responsibilities

- login
- register
- logout
- current user persistence
- dark/light theme persistence
- authentication error handling

### Main Methods

| Method | Purpose |
|---|---|
| login() | Authenticates user |
| register() | Creates new account |
| logout() | Clears local session |
| isLoggedIn() | Checks authentication state |
| getCurrentUser() | Returns logged-in user |
| getTheme() | Returns current theme |
| setTheme() | Stores selected theme |
| applyTheme() | Applies UI theme |

---

## SensorService

Handles communication with backend sensor APIs.

### Responsibilities

- session management
- saving sensor readings
- CSV export
- ML prediction requests
- retrieving sensor data

### Main Methods

| Method | Purpose |
|---|---|
| startSession() | Starts recording session |
| stopSession() | Stops recording session |
| getAllReadings() | Fetches all sensor readings |
| exportCsv() | Downloads CSV export |
| saveReading() | Saves sensor reading |
| predictStress() | Sends data to ML model |

---

## UserService

Handles user profile management.

### Responsibilities

- profile loading
- profile editing
- avatar updates
- profile validation

### Main Methods

| Method | Purpose |
|---|---|
| getUserProfile() | Fetches user profile |
| updateProfile() | Updates profile data |
| updateAvatar() | Updates avatar image |

---

## WebSocketService

Handles real-time communication with ESP8266.

### Responsibilities

- WebSocket connection
- live sensor streaming
- automatic reconnect
- connection status tracking
- reactive data updates

### Streams

| Stream | Purpose |
|---|---|
| data$ | Live Arduino sensor data |
| status$ | Connection state |

### Connection States

- connected
- disconnected
- error

### Main Methods

| Method | Purpose |
|---|---|
| connect() | Opens WebSocket connection |
| disconnect() | Closes WebSocket connection |
| scheduleReconnect() | Attempts reconnect automatically |

---

# Real-Time Frontend Flow

```text id="0j9pxg"
ESP8266 Sensors
      ↓
WebSocketService
      ↓
Angular Components
      ↓
SensorService
      ↓
Spring Boot Backend
      ↓
PostgreSQL + ML Model

# Frontend Architecture — Dashboard & Pages

## Dashboard Layout

The `DashboardComponent` represents the main shell of the authenticated application.  
It provides the global layout structure consisting of:

- a persistent sidebar navigation
- the main content area
- Angular Router integration through `router-outlet`

The dashboard acts as the central container for all application pages after authentication.

---

# Dashboard Component

## Responsibilities

The component is responsible for:

- rendering the sidebar navigation
- displaying the active page through routing
- retrieving the authenticated user
- generating user initials dynamically
- handling sidebar expand/collapse state

---

# Sidebar Navigation

The sidebar provides navigation between the main application modules.

## Navigation Pages

| Route | Purpose |
|---|---|
| `/dashboard/home` | Real-time stress monitoring dashboard |
| `/dashboard/trends` | Historical trends and analytics |
| `/dashboard/training` | Dataset collection and ML training sessions |
| `/dashboard/relax` | Breathing and meditation exercises |
| `/dashboard/profile` | User profile and application settings |

---

# Technologies Used

## Angular Router

Used for:
- client-side navigation
- lazy loading pages
- route activation state
- nested routing

## Angular Signals

Used for:
- reactive user state
- computed initials
- lightweight UI state management

## Angular Material

Used for:
- icons
- UI consistency
- responsive design components

---

# Home Page — Real-Time Monitoring

## Overview

The `HomePageComponent` is the main real-time monitoring interface of the application.

It continuously receives biometric data from the Arduino device through WebSocket communication and calculates the user's stress level using both:
- a rule-based algorithm
- a Machine Learning prediction model

---

# Main Functionalities

## Real-Time Sensor Monitoring

The page displays live biometric values:
- Heart Rate (BPM)
- Galvanic Skin Response (GSR)
- Temperature
- Finger detection state

Data is streamed continuously from the ESP32/Arduino device using WebSockets.

---

## Stress Score Calculation

A classic stress score is computed using weighted biometric indicators:

| Metric | Weight |
|---|---|
| BPM | 50% |
| GSR | 40% |
| Temperature | 10% |

The score is smoothed using exponential smoothing to avoid abrupt fluctuations.

Stress levels are categorized as:
- Relaxed
- Moderate
- Stressed

---

## Machine Learning Prediction

The component also performs stress prediction using a Machine Learning model.

### Features Sent to Backend

- BPM
- IBI (Inter-Beat Interval)
- GSR
- Temperature

The backend returns:
- stress probability
- predicted stress label

The prediction is additionally smoothed using exponential averaging to improve stability.

---

## Gauge Visualization

A circular SVG gauge visualizes:
- current stress percentage
- stress category
- ML prediction result

The gauge updates in real time according to the incoming biometric data.

---

## Passive Monitoring Session

When the page loads:
- a passive monitoring session is automatically started
- sensor readings begin streaming
- the session duration is tracked

When the component is destroyed:
- the session is stopped automatically
- WebSocket connections are closed

---

## Data Filtering

An IQR (Interquartile Range) filter is implemented to:
- remove sensor outliers
- stabilize noisy biometric data
- improve ML prediction quality

---

## Dynamic Insights

The page generates adaptive messages depending on stress level.

Examples:
- low stress encouragement
- moderate stress recommendations
- breathing exercise suggestions

---

# Trends Page — Analytics & Visualization

## Overview

The `TrendsPageComponent` provides historical stress analysis and weekly statistics visualization.

It transforms raw stress data into:
- charts
- statistical insights
- recovery analysis

---

# Technologies Used

## Chart.js + ng2-charts

Used for:
- line charts
- scatter event markers
- interactive tooltips
- responsive graphs

---

# Weekly Stress Visualization

The page displays:
- daily stress levels
- detected stress events
- weekly fluctuations

## Chart Types

| Dataset | Visualization |
|---|---|
| Stress level | Line chart |
| Stress events | Scatter points |

---

# Statistical Metrics

The analytics dashboard computes:

| Metric | Description |
|---|---|
| Average Stress | Weekly mean stress percentage |
| Peak Stress | Highest detected stress value |
| Stress Events | Number of high-stress moments |
| Recovery Time | Average recovery duration |

---

## Backend Integration

The component retrieves:
- weekly trend data
- aggregated statistics

through the `StressTrendsService`.

---

## Error Handling

If API requests fail:
- fallback mock data is loaded
- charts remain functional
- the UI does not crash

---

# Training Page — Dataset Collection

## Overview

The `TrainingPageComponent` is used to collect labeled biometric datasets for Machine Learning training.

Users can manually create sessions representing:
- relaxed states
- stressed states

---

# Main Functionalities

## Session Types

| Session Label | ML Value |
|---|---|
| Relaxed | 0 |
| Stressed | 1 |

---

## Real-Time Data Collection

During active sessions:
- live sensor data is continuously captured
- readings are saved to the backend
- the dataset grows incrementally

---

## Saved Features

Each reading contains:
- BPM
- IBI
- GSR
- Temperature
- Finger detection state
- Session ID
- User ID
- Stress label

---

## Session Timer

The component tracks:
- session duration
- total collected data points

The timer updates every second.

---

## WebSocket Integration

The page uses the `WebSocketService` to:
- receive live Arduino data
- monitor finger placement
- stream biometric readings

---

## Session Lifecycle

### Start Session
- creates backend session
- starts timer
- begins recording data

### Stop Session
- closes backend session
- stops timer
- finalizes dataset collection

---

# Relax Page — Stress Reduction Module

## Overview

The `RelaxPageComponent` provides guided stress reduction exercises.

It contains two modules:
- breathing exercises
- meditation sessions

---

# Breathing Module

## Supported Breathing Patterns

| Pattern | Description |
|---|---|
| Calm | 4s inhale / 4s exhale |
| Deep Relax | 4s inhale / 6s exhale |
| Box Breathing | 4-4-4-4 pattern |
| Energizing | 3s inhale / 3s exhale |

---

## Breathing Animation

The module includes:
- animated breathing circles
- inhale/exhale visual scaling
- countdown timers
- cycle tracking

---

## Reactive State Management

Angular Signals are used to manage:
- breathing phase
- countdown
- selected pattern
- running state
- paused state

---

# Meditation Module

## Features

The meditation module provides:
- configurable session durations
- animated circular timer
- rotating mindfulness messages
- pause/resume functionality

---

## Available Durations

| Duration | Seconds |
|---|---|
| 5 min | 300 |
| 10 min | 600 |
| 15 min | 900 |

---

## Meditation States

The meditation workflow supports:
- idle
- running
- paused
- completed

---

## Navigation Integration

After finishing relaxation exercises, users can:
- return to the Home page
- retest stress levels immediately

---

# Profile Page — User Management & Settings

## Overview

The `ProfilePageComponent` manages:
- user information
- appearance settings
- avatar uploads
- device connection status

---

# User Information

Users can edit:
- name
- email
- age
- weight
- height
- gender

These fields are later used for:
- ML calibration
- personalized analysis
- biometric interpretation

---

## Avatar Upload

The component supports:
- image selection
- Base64 image conversion
- avatar persistence through backend API

---

## Theme Management

Users can switch between:
- light mode
- dark mode

The theme preference is stored locally using `localStorage`.

---

## Device Status Monitoring

The page displays:
- real-time device connectivity
- WebSocket connection state
- live sensor availability

---

## Snackbar Notifications

Angular Material Snackbars are used for:
- success feedback
- update confirmations
- error reporting

---

## Logout Functionality

The component allows users to:
- terminate authentication sessions
- clear local storage
- return to the login page

---

# Reactive Frontend Architecture

## Angular Signals

The frontend heavily uses Angular Signals for:
- reactive UI updates
- lightweight state management
- computed values
- performance optimization

Signals replace much of the traditional RxJS state complexity.

---

## RxJS Usage

RxJS is still used for:
- HTTP requests
- WebSocket streams
- subscriptions
- asynchronous communication

---

## Standalone Components

The application uses Angular Standalone Components instead of NgModules.

Advantages:
- simplified architecture
- better scalability
- reduced boilerplate
- easier lazy loading

---

# Real-Time Communication Architecture

## WebSocket Communication

The frontend communicates with the ESP32 device through:
- persistent WebSocket connections
- automatic reconnection
- live sensor streaming

---

## Connection Recovery

The application implements automatic reconnection:
- retries every 3 seconds
- prevents infinite reconnect loops
- updates connection state reactively

---

# Frontend Design Principles

## UI/UX Goals

The interface was designed to be:
- minimalistic
- responsive
- calming
- real-time focused

---

## Design Features

The UI includes:
- gradient visual elements
- animated gauges
- smooth transitions
- responsive layouts
- live indicators
- dark/light themes