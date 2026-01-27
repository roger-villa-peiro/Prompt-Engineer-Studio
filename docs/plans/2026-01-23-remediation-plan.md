# Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Secure the application by effectively hiding API keys and improve maintainability by refactoring the monolithic service and UI architecture.

**Architecture:** We will introduce a lightweight Express proxy server to handle all AI requests, ensuring API keys remain server-side. concurrently, we will decompose the `PromptOptimizationService` and `PromptEditor` into focused, single-responsibility components.

**Tech Stack:** Node.js, Express, React, Vite, TypeScript.

---

### Task 1: Initialize Backend Proxy

**Files:**
- Create: `server/index.ts`
- Modify: `package.json`
- Modify: `.env`

**Step 1: Write the server initialization test expectation**
*Note: Since we are creating a new server, we verify by running it.*

**Step 2: Implement minimal Express server**

```typescript
// server/index.ts
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Add Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

**Step 3: Update package.json scripts**

```json
// Add to scripts
"server": "ts-node server/index.ts",
"dev:all": "concurrently \"npm run server\" \"npm run dev\""
```

**Step 4: Commit**
```bash
git add server/index.ts package.json
git commit -m "feat: initialize backend proxy server"
```

---

### Task 2: Implement Secure AI Endpoint

**Files:**
- Modify: `server/index.ts`
- Test: `curl` command verification

**Step 1: Implement Generate Endpoint**

```typescript
// server/index.ts
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey });

app.post('/api/generate', async (req, res) => {
  try {
    const { model, contents, config } = req.body;
    // ... validation ...
    const response = await genAI.getGenerativeModel({ model }).generateContent({
       contents, 
       generationConfig: config 
    });
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Step 2: Verify Endpoint**
Run: `curl -X POST http://localhost:3001/api/generate ...`
Expected: 200 OK with AI response.

**Step 3: Commit**
```bash
git add server/index.ts
git commit -m "feat: add secure generation endpoint"
```

---

### Task 3: Secure Frontend Configuration

**Files:**
- Modify: `vite.config.ts`
- Modify: `services/geminiService.ts`

**Step 1: Remove Keys from Vite Config**

```typescript
// vite.config.ts
// REMOVE these lines:
// 'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
```

**Step 2: Configure Proxy in Vite**

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
});
```

**Step 3: Refactor geminiService to use Proxy**

```typescript
// services/geminiService.ts
// Replace direct SDK usage with fetch('/api/generate')
async function callProxy(endpoint: string, data: any) {
  const res = await fetch(`/api/${endpoint}`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}
```

**Step 4: Verify Frontend works without exposed keys**
Run: `npm run build && grep "AIza" dist/assets/*.js`
Expected: No output (keys successfully hidden).

**Step 5: Commit**
```bash
git add vite.config.ts services/geminiService.ts
git commit -m "security: move ai calls to backend proxy"
```

---

### Task 4: Decompose PromptEditor

**Files:**
- Create: `components/DiffView.tsx`
- Modify: `components/PromptEditor.tsx`

**Step 1: Extract DiffView**
Move the `DiffView` component definition from `PromptEditor.tsx` to its own file.

**Step 2: Import and Replace**
Update `PromptEditor.tsx` to import `DiffView` instead of defining it inline.

**Step 3: Verify Render**
Check the UI to ensure the diff view still renders correctly.

**Step 4: Commit**
```bash
git add components/DiffView.tsx components/PromptEditor.tsx
git commit -m "refactor: extract DiffView component"
```

---

### Task 5: Performance Optimization

**Files:**
- Modify: `components/PromptEditor.tsx`

**Step 1: Implement Debounce**

```typescript
// hooks/useDebounce.ts (Create if needed, otherwise inline logic)
useEffect(() => {
  const handler = setTimeout(() => {
     localStorage.setItem('activePrompt', content);
  }, 1000);
  return () => clearTimeout(handler);
}, [content]);
```

**Step 2: Verify Performance**
Type rapidly. Check Application > Local Storage. The value should only update once typing stops.

**Step 3: Commit**
```bash
git add components/PromptEditor.tsx
git commit -m "perf: debounce local storage persistence"
```
