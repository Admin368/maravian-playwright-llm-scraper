# Maravian Playwright LLM Scraper

A sophisticated web scraping tool that combines the power of Playwright for browser automation with Large Language Models (LLM) for intelligent data extraction and navigation decisions.

## Features

- 🤖 Intelligent web scraping using OpenAI's GPT models
- 🎭 Powered by Playwright for reliable browser automation
- 🌐 Express.js API server with a clean web interface
- 🎯 Schema-based data extraction
- 🔄 Dynamic navigation decisions using LLM
- 🛡️ Built-in proxy support
- 📝 TypeScript for type safety

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Admin368/maravian-playwright-llm-scraper.git
cd maravian-playwright-llm-scraper
```

2. Install dependencies using pnpm:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```
Edit `.env` and add your OpenAI API key and optional proxy settings.

## Usage

### Starting the Server

Development mode:
```bash
pnpm dev
```

Production mode:
```bash
pnpm build
pnpm start
```

The server will start on `http://localhost:3000` by default.

### API Endpoint

Send POST requests to `/scrape` with the following JSON structure:

```json
{
  "url": "https://example.com",
  "maxSteps": 5,
  "targetSchema": {
    "type": "object",
    "properties": {
      "field_name": { "type": "string" }
    },
    "required": ["field_name"]
  }
}
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests in headed mode
pnpm test:headed

# Debug tests
pnpm test:debug
```

## Configuration

- `OPENAI_API_KEY`: Required for LLM functionality
- `USE_PROXY`: Enable proxy support (optional)
- `PROXY_URL`: HTTP/HTTPS proxy URL (optional)

## How It Works

1. The scraper accepts a target URL and a JSON schema describing the desired data
2. Playwright navigates to the URL and extracts page content
3. The LLM analyzes the content and makes decisions about:
   - Whether the required information is present
   - What elements to click or paths to navigate
4. The process continues until either:
   - The desired information is found
   - The maximum number of steps is reached
   - No valid next action is available

## Project Structure

- `/src`: Source code
  - `server.ts`: Express server setup
  - `scraper.ts`: Core scraping logic
  - `llm.ts`: LLM integration
  - `types.ts`: TypeScript type definitions
  - `config.ts`: Configuration management
- `/tests`: Test files
- `/static`: Web interface files

## Docker Deployment

You can run the application using Docker Compose:

1. Copy the environment variables file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your OpenAI API key and optional proxy settings.

3. Build and start the Docker container:
```bash
docker compose up -d
```

4. View logs:
```bash
docker compose logs -f
```

5. Stop the container:
```bash
docker compose down
```

The server will be available at `http://localhost:3000`.

## License

ISC

## Author

Maravian.com