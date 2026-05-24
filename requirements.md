# Requirements Document

## Introduction

A real-time 2D Pixel-Art Legal Cross-Examination Simulator where the user plays a cross-examining lawyer in a generative, unscripted courtroom. The system uses a low-latency multi-agent voice pipeline (STT → LLM → TTS) synchronized with a pixel-art game canvas. Sessions are ephemeral, capped at 10 minutes, and driven by a case discovery PDF uploaded by the user.

## Glossary

- **System**: The full pixel-art legal cross-examination simulator application
- **Session**: A single ephemeral courtroom simulation instance, lasting at most 10 minutes
- **Harvey**: The background case-analysis agent that parses the uploaded PDF and extracts structured case context
- **Harvey MCP**: The Model Context Protocol server that exposes Harvey's legal intelligence as callable tools; used both for pre-session PDF analysis and as the real-time legal reasoning backend for the lawyer agent during an active Session
- **Witness**: The AI agent playing the opposing witness or counsel, defending their position during cross-examination
- **Judge**: The AI agent moderating the courtroom, ruling on objections and enforcing decorum
- **Pipeline**: The end-to-end voice processing chain: STT → LLM → TTS
- **Canvas**: The Phaser.js or Pixi.js 2D pixel-art game rendering surface
- **Transcript**: The ordered log of all speaker turns within a Session
- **AgentState**: The per-agent emotional and logical parameters (e.g., witness stress level, judge patience level)
- **STT**: Speech-to-text service (Deepgram Live Streaming API)
- **TTS**: Text-to-speech service (RumiK SILK)
- **LLM**: Large language model service (Gemini API)

---

## Requirements

### Requirement 1: Case Discovery Upload

**User Story:** As a user, I want to upload a case discovery PDF before the simulation starts, so that the courtroom scenario is grounded in a specific set of facts and evidence.

#### Acceptance Criteria

1. THE System SHALL provide a landing interface that accepts a PDF file upload before a Session begins.
2. WHEN a user uploads a PDF, THE System SHALL validate that the file is a valid, non-empty PDF document.
3. IF the uploaded file is not a valid PDF or exceeds 20 MB, THEN THE System SHALL display a descriptive error message and allow the user to upload a different file.
4. WHEN a valid PDF is uploaded, THE System SHALL pass the document to Harvey for analysis before the Session starts.
5. THE System SHALL prevent a Session from starting until Harvey has completed case analysis.

---

### Requirement 2: Automated Case Analysis (Harvey)

**User Story:** As a user, I want the system to automatically analyze my uploaded case file, so that the AI agents are briefed on the facts, evidence, and inconsistencies before the trial begins.

#### Acceptance Criteria

1. WHEN a valid PDF is received, THE Harvey Agent SHALL invoke Harvey MCP tools server-side to extract facts, core arguments, evidence items, and logical inconsistencies from the document.
2. THE Harvey Agent SHALL produce a structured case context object containing: a case summary, a list of evidence items, a list of key facts, and a list of identified inconsistencies.
3. WHEN extraction is complete, THE Harvey Agent SHALL make the case context available to the Witness agent and the Judge agent before the Session begins.
4. IF Harvey MCP cannot extract meaningful content from the PDF (e.g., scanned image with no text layer), THEN THE System SHALL notify the user with a descriptive error and prompt re-upload.
5. THE Harvey Agent SHALL complete case analysis within 30 seconds of receiving the PDF.
6. THE System SHALL invoke all Harvey MCP tools exclusively on the server, never exposing Harvey MCP credentials or tool calls to the client.

---

### Requirement 3: Session Lifecycle Management

**User Story:** As a user, I want each simulation to be a self-contained, time-limited session, so that server resources are predictable and my experience is focused.

#### Acceptance Criteria

1. WHEN a user starts a simulation, THE System SHALL create a new Session with a unique session ID and a creation timestamp.
2. THE System SHALL enforce a maximum Session duration of 10 minutes from the Session creation timestamp.
3. WHEN a Session reaches the 10-minute limit, THE System SHALL terminate all active audio streams, agent processes, and WebSocket connections associated with that Session.
4. WHEN a Session is terminated, THE System SHALL delete all ephemeral Session data, including the Transcript and AgentState, from server memory.
5. THE System SHALL display a countdown timer visible to the user showing remaining Session time.
6. WHEN a Session ends, THE System SHALL display a summary screen showing the Transcript before clearing Session data.

---

### Requirement 4: Real-Time Voice Pipeline

**User Story:** As a user, I want to speak naturally and hear immediate AI responses, so that the cross-examination feels like a live, unscripted exchange.

#### Acceptance Criteria

1. THE System SHALL capture microphone audio from the user's browser and stream it to the STT service in real time.
2. WHEN the STT service produces a final transcript of the user's speech, THE System SHALL forward the transcript text to the active LLM agent within 100 ms.
3. WHEN the LLM agent produces a response, THE System SHALL stream the response text to the TTS service and begin audio playback within 500 ms of the first response token.
4. THE System SHALL assign a distinct voice profile to the Witness agent and a separate distinct voice profile to the Judge agent via the TTS service.
5. WHILE an agent is speaking, THE System SHALL allow the user to interrupt by speaking, causing the current TTS playback to stop and the Pipeline to process the user's new input.
6. IF the STT service connection is lost, THEN THE System SHALL attempt to reconnect within 2 seconds and notify the user of the interruption via a visual indicator.
7. IF the TTS service fails to return audio within 3 seconds of receiving text, THEN THE System SHALL display the agent's response as text on screen and log the failure.

---

### Requirement 5: Multi-Agent Courtroom Behavior

**User Story:** As a user, I want the Witness and Judge to behave as distinct, reactive agents, so that the simulation feels like a real adversarial courtroom exchange.

#### Acceptance Criteria

1. THE Witness Agent SHALL respond to user questions by defending the position established in the case context, using facts and arguments extracted by Harvey.
2. WHEN the user poses a question that contradicts an identified inconsistency, THE Witness Agent SHALL exhibit increased stress in its response tone, reflected in the AgentState stress parameter.
3. WHEN the user poses a legally improper question (e.g., leading, assumes facts not in evidence), THE Witness Agent SHALL object and state the basis for the objection.
4. THE Judge Agent SHALL evaluate each objection raised by the Witness Agent and respond with a ruling of "sustained" or "overruled" within the same conversational turn.
5. WHEN the Judge Agent sustains an objection, THE System SHALL prevent the Witness Agent from answering the objected question and prompt the user to rephrase.
6. WHEN the user's behavior is repeatedly disruptive (3 or more sustained objections in a row), THE Judge Agent SHALL issue a formal warning to the user.
7. THE Judge Agent SHALL maintain a patience parameter in AgentState, decremented by disruptive user behavior and incremented by proper questioning.
8. WHILE the Judge Agent's patience parameter reaches zero, THE System SHALL trigger a "contempt of court" event ending the Session early.

---

### Requirement 6: Synchronized 2D Pixel-Art Canvas

**User Story:** As a user, I want the pixel-art characters to animate in sync with the audio, so that I have clear visual feedback about who is speaking and what emotional state they are in.

#### Acceptance Criteria

1. THE Canvas SHALL render pixel-art character sprites for the user (lawyer), the Witness, and the Judge at all times during an active Session.
2. WHEN an agent begins speaking (TTS audio starts), THE Canvas SHALL trigger a talking animation on the corresponding character sprite.
3. WHEN an agent stops speaking (TTS audio ends), THE Canvas SHALL return the corresponding character sprite to its idle animation.
4. WHEN the Witness Agent's stress parameter increases, THE Canvas SHALL transition the Witness sprite to a higher-stress visual state (e.g., sweating, nervous expression).
5. WHEN the Judge Agent issues a ruling or warning, THE Canvas SHALL play a gavel-slam animation on the Judge sprite.
6. WHEN a "contempt of court" event is triggered, THE Canvas SHALL play a cinematic zoom-in animation on the Judge sprite.
7. THE Canvas SHALL display a visual microphone indicator that is active (lit) while the user's microphone is capturing audio and inactive (unlit) otherwise.
8. THE Canvas SHALL render at a minimum of 30 frames per second during an active Session on a modern desktop browser.

---

### Requirement 7: Security and Session Isolation

**User Story:** As a developer, I want API credentials and session data to be isolated and never exposed to the client, so that the system is secure and user sessions cannot interfere with each other.

#### Acceptance Criteria

1. THE System SHALL store all third-party API keys (Deepgram, Gemini, RumiK SILK) exclusively on the server and SHALL never transmit them to the client.
2. THE System SHALL isolate all Session data (Transcript, AgentState, case context) by session ID, ensuring one Session cannot read or modify another Session's data.
3. WHEN a Session ends or expires, THE System SHALL purge all associated data from server memory within 5 seconds of termination.
4. THE System SHALL authenticate WebSocket connections using a short-lived session token issued at Session creation.
5. IF a WebSocket message is received without a valid session token, THEN THE System SHALL reject the message and close the connection.

---

### Requirement 9: Lawyer Agent — Harvey MCP Integration

**User Story:** As a user playing the lawyer, I want Harvey MCP to back my in-session actions with real-time legal intelligence, so that I receive strategic coaching and can cross-examine more effectively.

#### Acceptance Criteria

1. WHILE a Session is active, THE System SHALL invoke Harvey MCP tools server-side to evaluate the legal strength of each question the user poses before surfacing a coaching hint.
2. WHEN Harvey MCP returns a strategy assessment, THE Canvas SHALL display the result to the user as a subtle on-screen coaching hint (e.g., a small text overlay or thought bubble on the lawyer sprite).
3. THE System SHALL invoke all Harvey MCP tools exclusively on the server and SHALL never transmit Harvey MCP credentials or raw tool responses to the client.
4. WHEN the user submits a question, THE System SHALL request a Harvey MCP strategy evaluation and surface the coaching hint within 2 seconds of the question being posed.
5. THE System SHALL use Harvey MCP to evaluate question strength both before the question is sent to the Witness Agent and after the Witness Agent responds, providing pre- and post-turn coaching.
6. IF Harvey MCP is unavailable during a Session, THEN THE System SHALL fall back to the base LLM for lawyer assistance, notify the user via a visible on-screen indicator, and continue the Session without interruption.

---

### Requirement 8: Transcript Logging

**User Story:** As a user, I want a record of the courtroom exchange, so that I can review what was said during the session.

#### Acceptance Criteria

1. THE System SHALL append each speaker turn to the Transcript in real time, recording the speaker identity, text content, and timestamp.
2. THE System SHALL display the Transcript to the user on the session summary screen after the Session ends.
3. THE Transcript SHALL preserve speaker turns in chronological order.
4. FOR ALL Transcript entries written during a Session, serializing then deserializing the Transcript SHALL produce an equivalent ordered list of entries (round-trip property).
