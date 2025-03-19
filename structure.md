mmo-project/
├── client/                     # Frontend code (Vite & Phaser)
│   ├── public/                 # Static files (favicon, index.html, etc.)
│   ├── src/
│   │   ├── assets/             # Game assets (images, audio, etc.)
│   │   ├── components/         # Reusable UI components if any
│   │   ├── scenes/             # Phaser game scenes (levels, menus, etc.)
│   │   ├── utils/              # Helper functions specific to the client
│   │   └── main.ts             # Entry point for the game
│   ├── vite.config.ts          # Vite configuration
│   └── package.json            # Client-specific dependencies & scripts
├── server/                     # Backend code (API, business logic)
│   ├── src/
│   │   ├── controllers/        # HTTP/WS controllers handling requests
│   │   ├── db/                 # Database related files
│   │   │   ├── migrations/     # Drizzle migration files
│   │   │   └── drizzle.config.ts  # Drizzle ORM configuration
│   │   ├── models/             # Data models and interfaces
│   │   ├── routes/             # API route definitions
│   │   ├── services/           # Business logic (including Redis caching)
│   │   ├── utils/              # Utility functions (logging, error handling, etc.)
│   │   └── server.ts           # Fastify server initialization
│   ├── tests/                  # Server-side tests
│   ├── Dockerfile              # Dockerfile to build the server container
│   ├── package.json            # Server-specific dependencies & scripts
│   └── tsconfig.json           # TypeScript configuration for the server
├── shared/                     # Shared code between client & server
│   ├── types/                  # Common type definitions (e.g., game entities, API responses)
│   └── utils/                  # Utility functions used in both projects
├── docker-compose.yml          # Compose file for orchestrating containers (Postgres, Redis, server, etc.)
├── .env                        # Environment variables (with separate .env files per service if needed)
├── .gitignore                  # Files/directories to ignore in version control
└── README.md                   # Project documentation
