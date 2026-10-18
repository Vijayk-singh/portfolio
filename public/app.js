'use strict';

const state = {
  data: null,
  filter: 'All work',
  adminTab: 'profile',
  editingProjectId: null,
  toastTimer: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function safeExternalUrl(value) {
  if (!value || typeof value !== 'string') return '';
  const url = value.trim();
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
  const type = response.headers.get('content-type') || '';
  const result = type.includes('application/json') ? await response.json() : {};
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
  return result;
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function openModal(id) {
  $(`#${id}`).hidden = false;
  document.body.classList.add('modal-open');
}

function closeModal(id) {
  $(`#${id}`).hidden = true;
  if (!$$('.modal-backdrop').some((modal) => !modal.hidden)) document.body.classList.remove('modal-open');
}

function renderProfile() {
  const p = state.data.profile;
  $('#profile-eyebrow').textContent = p.eyebrow || '';
  $('#profile-name-kicker').textContent = (p.name || '').toUpperCase();
  $('#profile-headline').textContent = p.headline || '';
  $('#profile-summary').textContent = p.summary || '';
  $('#profile-availability').textContent = p.availability || '';
  $('#profile-location').textContent = p.location || '';
  $('#profile-about').textContent = p.about || '';
  document.title = `${p.name || 'Portfolio'} | Software · Networks · Security`;
  const roleParts = (p.role || '').split(/[·|]/).map((part) => part.trim()).filter(Boolean).slice(0, 4);
  $('#hero-pills').innerHTML = roleParts.map((part) => `<span>${escapeHTML(part)}</span>`).join('');
  const navResume = $('#nav-resume');
  const resumeUrl = safeExternalUrl(p.resumeUrl);
  if (resumeUrl) {
    navResume.href = resumeUrl;
    navResume.target = resumeUrl.startsWith('http') ? '_blank' : '_self';
    navResume.rel = 'noreferrer';
    navResume.hidden = false;
  } else navResume.hidden = true;
  renderContactActions();
}

function renderContactActions() {
  const p = state.data.profile;
  const links = [];
  if (p.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) links.push(`<a class="contact-link primary" href="mailto:${escapeHTML(p.email)}">Email me <span>↗</span></a>`);
  const github = safeExternalUrl(p.githubUrl);
  const linkedin = safeExternalUrl(p.linkedinUrl);
  const resume = safeExternalUrl(p.resumeUrl);
  if (github) links.push(`<a class="contact-link" href="${escapeHTML(github)}" target="_blank" rel="noreferrer">GitHub <span>↗</span></a>`);
  if (linkedin) links.push(`<a class="contact-link" href="${escapeHTML(linkedin)}" target="_blank" rel="noreferrer">LinkedIn <span>↗</span></a>`);
  if (resume) links.push(`<a class="contact-link" href="${escapeHTML(resume)}" ${resume.startsWith('http') ? 'target="_blank" rel="noreferrer"' : ''}>Resume <span>↗</span></a>`);
  $('#contact-actions').innerHTML = links.join('');
}

function renderProjects() {
  const projects = Array.isArray(state.data.projects) ? [...state.data.projects].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))) : [];
  const categories = [...new Set(projects.map((project) => project.category).filter(Boolean))];
  if (!categories.includes(state.filter) && state.filter !== 'All work') state.filter = 'All work';
  $('#project-filters').innerHTML = ['All work', ...categories].map((category) => `
    <button type="button" class="filter-button ${state.filter === category ? 'active' : ''}" data-filter="${escapeHTML(category)}" aria-pressed="${state.filter === category}">${escapeHTML(category)}</button>
  `).join('');
  const filtered = state.filter === 'All work' ? projects : projects.filter((project) => project.category === state.filter);
  $('#project-count').textContent = `${String(filtered.length).padStart(2, '0')} PROJECT${filtered.length === 1 ? '' : 'S'}`;
  if (!filtered.length) {
    $('#project-grid').innerHTML = '<div class="empty-projects">No projects in this category yet.</div>';
    return;
  }
  $('#project-grid').innerHTML = filtered.map((project, index) => {
    const statusClass = String(project.status || '').toLowerCase().replace(/[^a-z]+/g, '-');
    const repo = safeExternalUrl(project.repoUrl);
    const demo = safeExternalUrl(project.demoUrl);
    return `<article class="project-card" data-project-card="${escapeHTML(project.id)}">
      <div class="project-card-top"><span class="project-category">${escapeHTML(project.category || 'Software Engineering')}</span><span class="project-status status-${escapeHTML(statusClass)}">${escapeHTML(project.status || 'In progress')}</span></div>
      <div class="project-card-main"><h3>${escapeHTML(project.title)}</h3><p>${escapeHTML(project.description || '')}</p><div class="project-stack">${(project.stack || []).map((item) => `<span>${escapeHTML(item)}</span>`).join('')}</div></div>
      <div class="project-card-footer"><span class="project-number">PROJECT / ${String(index + 1).padStart(2, '0')}</span><div class="project-links">
        ${project.details ? `<button class="project-link project-details-toggle" type="button" data-details="${escapeHTML(project.id)}" aria-expanded="false">Details <span>↗</span></button>` : ''}
        ${repo ? `<a class="project-link" href="${escapeHTML(repo)}" target="_blank" rel="noreferrer">Code <span>↗</span></a>` : ''}
        ${demo ? `<a class="project-link" href="${escapeHTML(demo)}" target="_blank" rel="noreferrer">Live <span>↗</span></a>` : ''}
      </div></div>
      ${project.details ? `<div class="project-detail-panel" id="details-${escapeHTML(project.id)}" hidden><p>${escapeHTML(project.details)}</p></div>` : ''}
    </article>`;
  }).join('');
}

function renderSkills() {
  const groups = state.data.skills || [];
  $('#skills-layout').innerHTML = groups.map((group, index) => `
    <article class="skill-group"><div class="skill-group-head"><span class="skill-index">0${index + 1}</span><h3>${escapeHTML(group.category)}</h3></div><div class="skill-chips">${(group.items || []).map((skill) => `<span class="skill-chip">${escapeHTML(skill)}</span>`).join('')}</div></article>
  `).join('');
}

function renderEducation() {
  $('#education-list').innerHTML = (state.data.education || []).map((item) => `
    <article class="education-item"><div class="education-period">${escapeHTML(item.period || '')}</div><div><h3 class="education-degree">${escapeHTML(item.degree || '')}${item.specialization ? ` <span>· ${escapeHTML(item.specialization)}</span>` : ''}</h3><div class="education-institution">${escapeHTML(item.institution || '')}</div>${item.note ? `<p class="education-note">${escapeHTML(item.note)}</p>` : ''}</div></article>
  `).join('');
}

function renderSite() {
  renderProfile();
  renderProjects();
  renderSkills();
  renderEducation();
  $('#footer-year').textContent = new Date().getFullYear();
}

async function loadPortfolio() {
  try {
    const data = await api('/api/portfolio');
    state.data = data;
    renderSite();
  } catch (error) {
    showToast(`Could not load portfolio: ${error.message}`);
  }
}

function profileFormHTML() {
  const p = state.data.profile;
  const field = (name, label, value, options = {}) => {
    const id = `profile-${name}`;
    const className = options.span ? 'form-field span-two' : 'form-field';
    const long = options.long || false;
    return `<div class="${className}"><label for="${id}">${label}</label>${long
      ? `<textarea id="${id}" name="${name}" maxlength="2500">${escapeHTML(value || '')}</textarea>`
      : `<input id="${id}" name="${name}" value="${escapeHTML(value || '')}" maxlength="${options.max || 300}" ${options.type ? `type="${options.type}"` : 'type="text"'} ${options.placeholder ? `placeholder="${escapeHTML(options.placeholder)}"` : ''}>`}</div>`;
  };
  return `<div class="admin-pane-title"><div><h3>Profile & links</h3><p>These fields power the homepage headline, introduction, and recruiter contact links.</p></div></div>
    <form class="admin-form" id="profile-form">
      ${field('name', 'Display name', p.name)}
      ${field('role', 'Role / focus areas', p.role)}
      ${field('eyebrow', 'Education / eyebrow line', p.eyebrow, { span: true })}
      ${field('headline', 'Hero headline', p.headline, { span: true })}
      ${field('summary', 'Short intro', p.summary, { span: true, long: true })}
      ${field('about', 'About / professional summary', p.about, { span: true, long: true })}
      ${field('location', 'Location', p.location)}
      ${field('availability', 'Opportunity preference', p.availability, { span: true })}
      ${field('email', 'Public email', p.email, { placeholder: 'you@example.com', max: 250 })}
      ${field('githubUrl', 'GitHub URL', p.githubUrl, { placeholder: 'https://github.com/username', max: 1000 })}
      ${field('linkedinUrl', 'LinkedIn URL', p.linkedinUrl, { placeholder: 'https://linkedin.com/in/username', max: 1000 })}
      ${field('resumeUrl', 'Resume URL or local path', p.resumeUrl, { placeholder: '/resume.pdf or https://…', max: 1000 })}
      <div class="form-actions"><button class="button button-primary" type="submit">Save profile <span>↗</span></button><span class="field-help">Only add contact details you want recruiters to see.</span></div>
    </form>`;
}

function skillsFormHTML() {
  const skills = state.data.skills || [];
  return `<div class="admin-pane-title"><div><h3>Skills & toolkit</h3><p>Each row becomes a skill group on the homepage. Enter individual skills separated by commas.</p></div></div>
    <form id="skills-form"><div class="admin-skills-groups" id="admin-skills-groups">${skills.map((group, index) => skillGroupFormHTML(group, index)).join('')}</div>
      <div class="form-actions" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:15px"><button class="button button-secondary" id="add-skill-group" type="button">+ Add category</button><button class="button button-primary" type="submit">Save skills <span>↗</span></button></div>
    </form><div class="admin-tip">Tip: keep this section focused on tools and concepts you can comfortably discuss in an interview.</div>`;
}

function skillGroupFormHTML(group = { category: '', items: [] }, index = 0) {
  return `<div class="admin-skill-row"><div class="admin-form"><div class="form-field"><label>Category</label><input class="skill-category-input" value="${escapeHTML(group.category || '')}" maxlength="80" placeholder="e.g. Systems & Networking"></div><div class="form-field"><label>Skills (comma-separated)</label><input class="skill-items-input" value="${escapeHTML((group.items || []).join(', '))}" placeholder="Linux, tcpdump, Wireshark"></div></div><div style="text-align:right;margin-top:8px"><button class="button-danger remove-skill-group" type="button">Remove category</button></div></div>`;
}

function projectsAdminHTML() {
  const projects = state.data.projects || [];
  $('#admin-project-count').textContent = String(projects.length).padStart(2, '0');
  if (state.editingProjectId !== null) return projectEditorHTML();
  return `<div class="admin-pane-title"><div><h3>Projects</h3><p>Create, update, and remove projects. Mark projects as featured to show them before non-featured work on the public page.</p></div></div>
    <div class="admin-list-toolbar"><p>${projects.length} project${projects.length === 1 ? '' : 's'} currently on the site.</p><button class="button button-primary" id="new-project-button" type="button">+ New project</button></div>
    <div class="admin-project-list">${projects.map((project, index) => `<article class="admin-project-item"><span class="admin-project-index">${String(index + 1).padStart(2, '0')}</span><div class="admin-project-info"><h4>${escapeHTML(project.title)}</h4><p>${escapeHTML(project.description || '')}</p><div class="admin-project-meta"><span>${escapeHTML(project.category || 'Project')}</span><span>· ${escapeHTML(project.status || 'In progress')}</span>${project.featured ? '<span>· FEATURED</span>' : ''}</div></div><div class="admin-project-actions"><button type="button" data-edit-project="${escapeHTML(project.id)}">Edit</button><button type="button" data-delete-project="${escapeHTML(project.id)}">Delete</button></div></article>`).join('')}</div>
    <div class="admin-tip">Before sharing a project publicly, verify its status, description, and repository/demo URL. No metrics or outcomes are fabricated for you.</div>`;
}

function projectEditorHTML() {
  const project = state.editingProjectId === 'new' ? {
    id: '', title: '', category: 'Software Engineering', status: 'In progress', featured: false, description: '', details: '', stack: [], repoUrl: '', demoUrl: ''
  } : (state.data.projects || []).find((item) => item.id === state.editingProjectId);
  if (!project) {
    state.editingProjectId = null;
    return projectsAdminHTML();
  }
  const isNew = state.editingProjectId === 'new';
  const f = (name, label, value, options = {}) => `<div class="form-field ${options.span ? 'span-two' : ''}"><label for="project-${name}">${label}</label>${options.textarea
    ? `<textarea id="project-${name}" name="${name}" maxlength="${options.max || 3000}" ${options.required ? 'required' : ''}>${escapeHTML(value || '')}</textarea>`
    : `<input id="project-${name}" name="${name}" value="${escapeHTML(value || '')}" maxlength="${options.max || 1600}" ${options.required ? 'required' : ''} ${options.placeholder ? `placeholder="${escapeHTML(options.placeholder)}"` : ''}>`}</div>`;
  return `<button class="project-editor-back" id="back-to-projects" type="button">← Back to all projects</button>
    <div class="admin-pane-title"><div><h3>${isNew ? 'Add a project' : 'Edit project'}</h3><p>Describe the problem, what you built, and the tools you used. Keep it specific and interview-safe.</p></div></div>
    <form class="admin-form" id="project-form" data-project-id="${escapeHTML(project.id)}">
      ${f('title', 'Project title', project.title, { required: true })}
      ${f('category', 'Category', project.category, { required: true })}
      <div class="form-field"><label for="project-status">Status</label><select id="project-status" name="status"><option ${project.status === 'Built' ? 'selected' : ''}>Built</option><option ${project.status === 'In progress' ? 'selected' : ''}>In progress</option><option ${project.status === 'Research' ? 'selected' : ''}>Research</option><option ${project.status === 'Archived' ? 'selected' : ''}>Archived</option></select></div>
      <div class="form-field"><label>Show as featured</label><label class="check-line"><input name="featured" type="checkbox" ${project.featured ? 'checked' : ''}> Feature this project</label></div>
      ${f('description', 'Short card description', project.description, { span: true, textarea: true, required: true, max: 1600 })}
      ${f('details', 'Additional details', project.details, { span: true, textarea: true, max: 3000 })}
      ${f('stack', 'Tech stack (comma-separated)', (project.stack || []).join(', '), { span: true, placeholder: 'Python, Pytest, Linux', max: 800 })}
      ${f('repoUrl', 'Repository URL', project.repoUrl, { placeholder: 'https://github.com/…', max: 1000 })}
      ${f('demoUrl', 'Live demo URL', project.demoUrl, { placeholder: 'https://…', max: 1000 })}
      <div class="form-actions"><button class="button button-primary" type="submit">${isNew ? 'Create project' : 'Save changes'} <span>↗</span></button><button class="button button-secondary" id="cancel-project-edit" type="button">Cancel</button></div>
    </form>
    ${isNew ? '' : `<div class="danger-zone"><p>Deleting permanently removes this project from the portfolio data file.</p><button class="button-danger" id="delete-current-project" type="button">Delete project</button></div>`}`;
}

function renderAdminContent() {
  const content = $('#admin-content');
  if (!state.data) {
    content.innerHTML = '<div class="admin-loading">Loading your portfolio settings…</div>';
    return;
  }
  if (state.adminTab === 'profile') content.innerHTML = profileFormHTML();
  else if (state.adminTab === 'skills') content.innerHTML = skillsFormHTML();
  else content.innerHTML = projectsAdminHTML();
}

async function openAdmin() {
  try {
    const result = await api('/api/admin/session');
    if (result.authenticated) {
      if (!state.data) await loadPortfolio();
      state.adminTab = 'profile';
      state.editingProjectId = null;
      renderAdminContent();
      updateAdminTabStates();
      openModal('admin-modal');
    } else {
      $('#admin-password').value = '';
      $('#login-error').textContent = '';
      openModal('login-modal');
      setTimeout(() => $('#admin-password').focus(), 30);
    }
  } catch (error) {
    showToast(error.message);
  }
}

function updateAdminTabStates() {
  $$('.admin-tab').forEach((button) => button.classList.toggle('active', button.dataset.adminTab === state.adminTab));
}

async function refreshPortfolio() {
  const data = await api('/api/portfolio');
  state.data = data;
  renderSite();
  $('#admin-project-count').textContent = String((data.projects || []).length).padStart(2, '0');
}

function collectProfileForm(form) {
  const fd = new FormData(form);
  const result = {};
  for (const [key, value] of fd.entries()) result[key] = String(value).trim();
  return result;
}

function collectProjectForm(form) {
  const fd = new FormData(form);
  return {
    title: String(fd.get('title') || '').trim(),
    category: String(fd.get('category') || '').trim(),
    status: String(fd.get('status') || 'In progress'),
    featured: fd.has('featured'),
    description: String(fd.get('description') || '').trim(),
    details: String(fd.get('details') || '').trim(),
    stack: String(fd.get('stack') || '').split(',').map((item) => item.trim()).filter(Boolean),
    repoUrl: String(fd.get('repoUrl') || '').trim(),
    demoUrl: String(fd.get('demoUrl') || '').trim()
  };
}

async function deleteProject(id) {
  const project = (state.data.projects || []).find((item) => item.id === id);
  if (!project) return;
  if (!window.confirm(`Delete “${project.title}” from your portfolio? This cannot be undone.`)) return;
  try {
    await api(`/api/admin/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
    state.editingProjectId = null;
    await refreshPortfolio();
    state.adminTab = 'projects';
    renderAdminContent();
    updateAdminTabStates();
    showToast('Project deleted.');
  } catch (error) {
    showToast(error.message);
  }
}

function bindEvents() {
  $('#admin-open').addEventListener('click', openAdmin);
  $('#footer-admin').addEventListener('click', openAdmin);
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.closeModal)));
  $$('.modal-backdrop').forEach((backdrop) => backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeModal(backdrop.id);
  }));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      $$('.modal-backdrop').forEach((modal) => { if (!modal.hidden) closeModal(modal.id); });
    }
  });

  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('button[type="submit"]', event.currentTarget);
    button.disabled = true;
    $('#login-error').textContent = '';
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify({ password: $('#admin-password').value }) });
      closeModal('login-modal');
      await refreshPortfolio();
      state.adminTab = 'profile';
      state.editingProjectId = null;
      renderAdminContent();
      updateAdminTabStates();
      openModal('admin-modal');
      $('#admin-password').value = '';
      showToast('You are signed in.');
    } catch (error) {
      $('#login-error').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  $('#logout-button').addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch { /* closing dashboard still works */ }
    closeModal('admin-modal');
    showToast('You have logged out.');
  });

  $$('.admin-tab').forEach((button) => button.addEventListener('click', () => {
    state.adminTab = button.dataset.adminTab;
    state.editingProjectId = null;
    updateAdminTabStates();
    renderAdminContent();
  }));

  $('#admin-content').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    if (form.id === 'profile-form') {
      try {
        await api('/api/admin/profile', { method: 'PUT', body: JSON.stringify(collectProfileForm(form)) });
        await refreshPortfolio();
        renderAdminContent();
        showToast('Profile and links saved.');
      } catch (error) { showToast(error.message); }
    } else if (form.id === 'skills-form') {
      try {
        const groups = $$('.admin-skill-row', form).map((row) => ({
          category: $('.skill-category-input', row).value.trim(),
          items: $('.skill-items-input', row).value.split(',').map((item) => item.trim()).filter(Boolean)
        }));
        await api('/api/admin/skills', { method: 'PUT', body: JSON.stringify({ skills: groups }) });
        await refreshPortfolio();
        renderAdminContent();
        showToast('Skills saved.');
      } catch (error) { showToast(error.message); }
    } else if (form.id === 'project-form') {
      const project = collectProjectForm(form);
      const isNew = state.editingProjectId === 'new';
      const id = form.dataset.projectId;
      try {
        await api(isNew ? '/api/admin/projects' : `/api/admin/projects/${encodeURIComponent(id)}`, {
          method: isNew ? 'POST' : 'PUT', body: JSON.stringify(project)
        });
        await refreshPortfolio();
        state.editingProjectId = null;
        state.adminTab = 'projects';
        renderAdminContent();
        updateAdminTabStates();
        showToast(isNew ? 'Project created.' : 'Project updated.');
      } catch (error) { showToast(error.message); }
    }
  });

  $('#admin-content').addEventListener('click', async (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.id === 'add-skill-group') {
      $('#admin-skills-groups').insertAdjacentHTML('beforeend', skillGroupFormHTML({ category: '', items: [] }));
    } else if (target.classList.contains('remove-skill-group')) {
      const rows = $$('.admin-skill-row', $('#admin-skills-groups'));
      if (rows.length === 1) { showToast('Keep at least one skill category, or clear its skill items.'); return; }
      target.closest('.admin-skill-row').remove();
    } else if (target.id === 'new-project-button') {
      state.editingProjectId = 'new'; renderAdminContent();
    } else if (target.dataset.editProject) {
      state.editingProjectId = target.dataset.editProject; renderAdminContent();
    } else if (target.dataset.deleteProject) {
      await deleteProject(target.dataset.deleteProject);
    } else if (target.id === 'back-to-projects' || target.id === 'cancel-project-edit') {
      state.editingProjectId = null; renderAdminContent();
    } else if (target.id === 'delete-current-project') {
      if (state.editingProjectId && state.editingProjectId !== 'new') await deleteProject(state.editingProjectId);
    }
  });

  $('#project-filters').addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    state.filter = button.dataset.filter;
    renderProjects();
  });
  $('#project-grid').addEventListener('click', (event) => {
    const button = event.target.closest('[data-details]');
    if (!button) return;
    const panel = $(`#details-${CSS.escape(button.dataset.details)}`);
    if (!panel) return;
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', String(!panel.hidden));
    button.innerHTML = panel.hidden ? 'Details <span>↗</span>' : 'Close details <span>↖</span>';
  });

  $('#mobile-menu').addEventListener('click', () => {
    const menu = $('.main-nav');
    const open = menu.classList.toggle('open');
    $('#mobile-menu').setAttribute('aria-expanded', String(open));
  });
  $$('.main-nav a').forEach((link) => link.addEventListener('click', () => {
    $('.main-nav').classList.remove('open');
    $('#mobile-menu').setAttribute('aria-expanded', 'false');
  }));
}

bindEvents();
loadPortfolio();
