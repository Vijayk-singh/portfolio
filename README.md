# Vijay Kumar — Portfolio Website

A responsive, recruiter-focused personal portfolio with a server-side admin login and dynamic CRUD management for projects, profile details, and skill groups.

## Features

- Responsive portfolio with selected projects, project-category filters, detail expanders, skills, education, and contact links.
- Admin login; password is checked on the server, not shipped to the browser.
- Edit the hero, summary, professional details, contact links, resume URL, and availability text.
- Create, edit, and delete projects; manage status, category, descriptions, stack, repository/demo links, and featured state.
- Edit skill groups and skills.
- Portfolio content is saved to `data/portfolio.json` (or the directory configured through `DATA_DIR`).
- No fabricated contact details, project links, or impact metrics are included.

## Run locally

Requires Node.js 20 or newer. No third-party npm packages are required.

```bash
cp .env.example .env
npm start
```

Then open `http://localhost:3000`.

### Admin login

The local demo fallback password is:

```text
Vijay@2026!
```

You can override it with `ADMIN_PASSWORD` in `.env`. Before any public deployment, set a long, unique password through `ADMIN_PASSWORD`. Do not commit `.env` to Git.

## Set up your public portfolio before sharing it

1. Log in and add your real public email, GitHub profile, LinkedIn profile, and resume URL.
2. Add real repository/demo links for projects. Remove or update any project that is not current.
3. Check each project's status and wording, especially the projects marked **In progress**.
4. Review all listed technologies and remove anything you would not feel comfortable discussing in an interview.

The default data is based on details shared in chat and uses cautious descriptions where implementation status or links were not provided.

## Deployment notes

This is a Node.js server app, not a static-only site. Deploy it to a Node-compatible host. Because edits are saved to a JSON file, the deployed service needs a persistent writable disk/volume. Set `DATA_DIR` to that persistent path (for example `/var/data` when that path is mounted by your host), and configure `ADMIN_PASSWORD` and `NODE_ENV=production` in the host's environment variables. Point the service start command to `npm start`.

Important: admin sessions are kept in memory. They are cleared when the process restarts and do not work across multiple server instances. For a larger or business-critical portfolio, move sessions and portfolio content to a managed database/session store and use a unique environment-based admin password.

## Project structure

```text
vijay-portfolio/
├── data/portfolio.json
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── .env.example
├── package.json
└── server.js
```
