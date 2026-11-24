# Mergington High School Activities API

A super simple FastAPI application that allows students to view and sign up for extracurricular activities.

## Features

- View all available extracurricular activities
- Sign up for activities
- Database-driven school announcements with optional start times and required expiration times
- Signed-in teachers can create, edit, and delete announcements from the header's **Manage announcements** dialog

## Getting Started

1. Install the dependencies:

   ```
   pip install -r requirements.txt
   ```

2. Start MongoDB on `localhost:27017`, then run the application from the repository root:

   ```
   uvicorn src.app:app --reload
   ```

3. Open your browser and go to:
   - API documentation: http://localhost:8000/docs
   - Alternative documentation: http://localhost:8000/redoc

## API Endpoints

| Method | Endpoint                                                          | Description                                                         |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| GET    | `/activities`                                                     | Get all activities with their details and current participant count |
| POST   | `/activities/{activity_name}/signup?email=student@mergington.edu` | Sign up for an activity                                             |
| GET    | `/announcements` | List currently active announcements (public) |
| GET    | `/announcements/manage` | List all announcements (signed-in users only) |
| POST   | `/announcements` | Create an announcement (signed-in users only) |
| PUT    | `/announcements/{id}` | Edit an announcement (signed-in users only) |
| DELETE | `/announcements/{id}` | Delete an announcement (signed-in users only) |

Announcement writes accept JSON containing `title` (1–120 characters), `message`
(1–2000 characters), `expires_at` (required), and `starts_at` (optional/null).
Dates must be ISO 8601 timestamps with a timezone; expiration must follow the
start time when one is supplied. The dialog uses the user's local timezone.
Messages appear immediately when no start is specified and disappear at expiration.
The noticeboard refreshes every 30 seconds; expired messages remain available in management.

Log in through `/auth/login` to receive an eight-hour, HttpOnly, SameSite session
cookie. `/auth/check-session` validates that cookie; `/auth/logout` revokes it.
Supplying a username alone does not grant announcement management access.

## Data Model

The application uses a simple data model with meaningful identifiers:

1. **Activities** - Uses activity name as identifier:

   - Description
   - Schedule
   - Maximum number of participants allowed
   - List of student emails who are signed up

2. **Students** - Uses email as identifier:
   - Name
   - Grade level

3. **Announcements** - MongoDB-generated identifiers, title, message, optional
   start timestamp, and required expiration timestamp.

Data persists in the `mergington_high` MongoDB database. Initialization adds an
example announcement, expiring 30 days later, when the announcements collection
is first created. Deleting all announcements does not reseed them on restart.
