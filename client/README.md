# Modern Chat App — web client

React 19 + TypeScript + Vite + Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (Radix).

```bash
npm install
npm run dev      # http://localhost:5173 (proxies /api, /uploads, /socket.io to http://localhost:3000)
npm run build    # outputs dist/, which the Express server serves at http://localhost:3000
```

- `src/store/chat.ts`: app state and all Socket.IO event listeners (Zustand)
- `src/lib/`: REST helpers (`api.ts`), types, formatting, emoji data
- `src/components/`: Sidebar, chat panel, stories, settings, file viewer
- `src/components/ui/`: shadcn/ui components. Add more with `npx shadcn@latest add <component>`
