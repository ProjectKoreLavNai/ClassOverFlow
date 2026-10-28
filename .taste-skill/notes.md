# ClassOverflow restyle — notes

Style: achromatic-ledger (seed 626552883). Shell redrawn twice (No sidebar → Icon rail → Open plane);
none kept the user's stated structure (top bar + labelled sidebar, Google Classroom). Kept the existing
T-frame (48px top bar + 240px labelled sidebar on one ground, 1px rules) with the style's tokens.

## Inventory
- Objects: courses (code, title, section, room, instructor, term, class code, units → topics with hours),
  announcements (author, role, time, title, body, streamed to Discord), classwork (assignment / quiz /
  lecture plan, points, due), gradebook rows (roll, attended/25, assignment/30, quiz/20, midterm/50),
  roster (name, roll, email, CR flag), users (role, verified).
- Magnitudes: 4 courses, ~55-60 students each, 25 classes held, 75% attendance minimum, 1-5 topics a course.
- People: teacher (daily, desktop), students and CR (phone, quick look), admin (rare).
- Jobs: open a course; post to the stream; tick off a topic; submit work; broadcast a deadline; verify a user.
- Its own things: course colours (Google Classroom's cards), class codes, the 75% attendance rule,
  Semester 3-1 · CSE, Discord channel per course.

## Questions
- Home: "Where is each of my courses, and what's due next?" → course cards; coverage bar is the data.
- Course: "What's happening in this class?" → stream; header strip answers coverage / enrolment / attendance.
- Grades: "Who is below the 75% attendance minimum?" → finding in the title row; attendance bar with 75% tick.

## Face
- Ground from the product's world: stone #f4f3f1 (a trace of the old paper warmth, under the cream check).
- Course identity colours kept from the old brand family (sage, slate, brass, teal, crimson) as pale
  banner tints with the deep hue on the course code only. Flat, no gradients.
- Chart hue #1d5fbf on syllabus coverage (the main data element) and nowhere in the chrome.
- Mark: a box with three lines, the last running out of it ("overflow").

## Signature element
- Attendance against the 75% minimum: each student's attendance as a bar with a tick at 75%; below it in
  the negative colour. The finding ("1 student below 75%") sits in the grades title row.

## Data rules
- Totals and percentages computed from rows (gradebook total = parts; attendance % = attended/held;
  course average attendance = mean of rows, used by the header strip and the AI summary alike).
- No invented fallbacks (removed `68 - index*14`, `|| 58`, hard-coded 94.2%).
