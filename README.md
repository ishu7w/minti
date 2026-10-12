# Minti Answer Assistant

A dependency-free Manifest V3 Chrome/Edge extension that reads visible participant questions, requests an AI answer, and lets you apply it. Automatic mode detects new questions and generates suggestions while the popup or side panel remains visible. It does not click Submit automatically; selecting a radio option may itself submit on some pages. Requires Chrome 116+ or an Edge version supporting the Side Panel API.

## Install

1. Open `chrome://extensions` (Edge: `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this repository's `extension` folder.
4. Open a participant question on `menti.com`, then click the extension icon.
5. Enter your provider's API base URL, API key, and exact model ID. Click **Save & allow provider**.
6. Click **Read page**, check the detected question/options, then **Ask AI**.
7. Review the answer and click **Apply answer** or **Copy answer**.
8. For longer sessions, click **Open persistent side panel**, then enable automatic mode in the side panel. It stays beside the page when you interact with it. Open the extension from the participant tab first to grant active-tab access. If access expires after navigation, click the extension icon on the participant tab again.

**Cancel request** stops the current AI request; it does not undo any charge already incurred at the provider. **Clear saved key** removes the key from this browser session and clears answers/cache in the current panel. Another already-open panel may still hold its own entered key; close other extension panels when clearing credentials.

## Providers

Uses `POST <base URL>/chat/completions` with OpenAI-compatible `messages` and Bearer authentication. Examples: OpenAI base `https://api.openai.com/v1`; OpenRouter base `https://openrouter.ai/api/v1`; local compatible server base `http://localhost:1234/v1`. Obtain the model ID from your provider. Any key is accepted in settings, but it must be valid for the selected provider. APIs requiring different headers or request formats (such as native Anthropic/Gemini APIs) need an adapter. A ChatGPT subscription is separate from API access.

Provider access is requested for the configured origin. Keys are kept in extension session storage, not written to disk by the extension, and not sent to the question page. Session storage clears when the browser exits or the extension is reloaded/disabled. The configured provider receives the question and choice text. Requests may incur provider charges. There is no analytics or backend.

## Current limits

Verified on a real Mentimeter participant Multiple Choice slide in a dedicated test presentation. Timed Select Answer quiz slides remain unverified. Extraction uses visible headings and radio/checkbox controls with accessible labels. Custom answer buttons, image questions, iframes, and multi-answer questions are not supported. Paste missing questions/options manually; manual edits disable Apply because the answer is no longer tied to a verified page snapshot. Stale answers cannot be applied after the detected question changes. Automatic mode stops when the panel closes or becomes hidden and does not retry failed AI requests automatically; use Ask AI to retry. Switching to an unsupported or inaccessible tab clears stale answers; detection resumes when an accessible participant tab becomes active.

## Development

No build step or dependencies. Reload the extension after editing files. Run `node --check extension/page.js` and `node --check extension/popup.js` to check syntax. Test detection, AI requests, stale-question rejection, and application against a presentation you can access before relying on it during a quiz. AI responses are not guaranteed correct.

Run `node tests/page.cjs` for dependency-free page-parser regression checks, including join/wait screens. For a deterministic local API fixture, run `python3 tests/local-provider.py`, set the API base to `http://127.0.0.1:8765/v1`, leave the key empty, and use model `local-test`. It returns canned answers, HTTP 401 for questions containing `fail`, and a 15-second delay for questions containing `slow`. This fixture is for testing only, not an AI provider.

Real Chrome testing confirmed local installation, side-panel opening, provider permission requests, real local API fetches, answer copying, cache reuse, and HTTP 401 handling. Join screens were initially misidentified as questions; extraction now requires answer controls and skips join/wait headings. Provider settings collapse after saving to keep answer controls accessible. On the real participant Multiple Choice slide, automatic mode detected “What is 2 + 2?” and choices 3/4/5, returned the cached fixture answer 4, and Apply selected radio option 4. After manually clicking Submit, the presenter results showed 4 with one vote and other options with zero. The extension then cleared the question and answer and displayed “Waiting for the next question…”. Live paid AI inference was not tested; the local fixture supplies canned answers.


### Speed and regression testing

Expanded testing: the installed, reloaded extension passed a longer live geography question with Paris/London/Rome/Berlin choices. Automatic detection preserved the full question and choices, the local provider returned Paris in 0.01 seconds, Apply selected Paris, and after Submit the presenter showed Paris=1 and the other cities=0. The participant waiting screen cleared the old answer. The dependency-free parser suite also passes 100 sequential long Unicode questions with 12 detailed choices each, matching selection and rejecting each obsolete snapshot. These tests exposed and fixed whitespace normalization in accessible choice labels and a false join-screen classification for answer prompts containing “name”. These measurements use canned local responses and do not measure AI accuracy or external provider latency.

Automatic mode checks immediately, then every 300 ms. A MutationObserver caches page extraction until the DOM changes, with invalidation on scroll and resize. Only one scan runs at a time. New questions cancel obsolete provider requests rather than waiting for them to finish. Up to 50 successful answers are cached in popup memory, keyed by provider, model, key, question, and options. Changing settings clears the cache. Each response shows measured request time or a cache indicator. Provider/model inference and network latency determine the remaining delay; choose a low-latency model to reduce it.

Run `node tests/browser.cjs` with Playwright installed and Google Chrome available. This launches isolated headless Chrome and tests the actual popup scripts with mocked extension APIs and a mocked AI provider, including cancellation during a slide change, cache hits, stale-answer rejection, API error recovery, and the file preview. It does not call a paid provider or verify a live Mentimeter session.
