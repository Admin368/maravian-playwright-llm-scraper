# Objective: Build a TypeScript server for web scraping with Playwright and LLM

- [x] Setup Node.js project with TypeScript
- [x] Install dependencies (Playwright, Express, LLM client, dotenv)
- [x] Define project structure
- [x] Create type definitions (`types.ts`)
- [x] Implement LLM interaction module (`llm.ts`) - _Initial placeholder_
- [x] Implement Playwright scraping logic (`scraper.ts`) - _Initial structure_
- [x] Implement Express server (`server.ts`) - _Basic setup_
- [x] Define API endpoint (`/scrape`)
- [ ] Implement core scraping loop (fetch, analyze, navigate) - _Partially done in scraper.ts_
- [ ] Implement LLM logic for information extraction and formatting - _Placeholder prompt in llm.ts_
- [ ] Implement LLM logic for deciding next action (click) - _Placeholder prompt in llm.ts_
- [ ] Add error handling - _Basic handling added_
- [x] Add max steps limit - _Implemented in scraper.ts_
- [ ] Add user-defined schema handling - _Passed to LLM, needs prompt refinement_
- [ ] Refine prompts and logic
- [ ] Add basic README
- [ ] Create .gitignore file
