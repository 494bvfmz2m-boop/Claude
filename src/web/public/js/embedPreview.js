(function () {
  const form = document.getElementById('embed-form');
  const fieldsContainer = document.getElementById('fields-container');
  const addFieldBtn = document.getElementById('add-field');
  const preview = document.getElementById('preview');

  // New rows start numbering after however many the server already rendered,
  // so their mention-target IDs never collide with the existing ones.
  let nextFieldIndex = fieldsContainer.querySelectorAll('.field-row').length;

  function roleOptionsHtml() {
    return (window.MODSENTRY_ROLES || []).map((r) => `<option value="${r.id}">${r.name}</option>`).join('');
  }

  function mentionToolsHtml(targetId) {
    const guildId = window.MODSENTRY_GUILD_ID || '';
    return `
      <div class="mention-tools">
        <select id="roleSel_${targetId}">
          <option value="">Insert role…</option>
          ${roleOptionsHtml()}
        </select>
        <button type="button" class="btn btn-ghost btn-sm" onclick="insertRoleMention('${targetId}','roleSel_${targetId}')">+ Role</button>
        <input type="text" id="userInput_${targetId}" placeholder="username" style="width:110px;">
        <button type="button" class="btn btn-ghost btn-sm" onclick="insertUserMention('${targetId}','userInput_${targetId}','${guildId}')">+ User</button>
        <input type="datetime-local" id="timeInput_${targetId}" style="width:180px;">
        <select id="timeFormat_${targetId}">
          <option value="F">Aug 26, 2026 5:00 PM</option>
          <option value="f">Aug 26, 5:00 PM</option>
          <option value="D">August 26, 2026</option>
          <option value="d">08/26/2026</option>
          <option value="t">5:00 PM</option>
          <option value="T">5:00:00 PM</option>
          <option value="R">in 3 hours</option>
        </select>
        <button type="button" class="btn btn-ghost btn-sm" onclick="insertTimestamp('${targetId}','timeInput_${targetId}','timeFormat_${targetId}')">+ Time</button>
      </div>
    `;
  }

  function fieldRowTemplate() {
    const targetId = `fieldValue_${nextFieldIndex++}`;
    const row = document.createElement('div');
    row.className = 'field-row';
    row.innerHTML = `
      <div><label style="margin:0 0 4px;">Name</label><input type="text" name="fieldName[]"></div>
      <div>
        <label style="margin:0 0 4px;">Value</label>
        <input type="text" name="fieldValue[]" id="${targetId}">
        ${mentionToolsHtml(targetId)}
      </div>
      <div><label style="margin:0 0 4px;">Inline</label>
        <select name="fieldInline[]"><option value="false">No</option><option value="true">Yes</option></select>
      </div>
      <div><button type="button" class="btn btn-ghost btn-sm remove-field" style="margin-top:20px;">✕</button></div>
    `;
    return row;
  }

  addFieldBtn.addEventListener('click', () => {
    fieldsContainer.appendChild(fieldRowTemplate());
  });

  fieldsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-field')) {
      e.target.closest('.field-row').remove();
      renderPreview();
    }
  });

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderPreview() {
    const data = new FormData(form);
    preview.innerHTML = '';
    preview.style.borderLeftColor = data.get('color') || '#5865F2';

    const authorName = data.get('authorName');
    const authorIconUrl = data.get('authorIconUrl');
    if (authorName) {
      const row = el('div', 'author');
      if (authorIconUrl) {
        const img = document.createElement('img');
        img.src = authorIconUrl;
        img.alt = '';
        row.appendChild(img);
      }
      row.appendChild(document.createTextNode(authorName));
      preview.appendChild(row);
    }

    const thumbnailUrl = data.get('thumbnailUrl');
    if (thumbnailUrl) {
      const img = document.createElement('img');
      img.className = 'thumb';
      img.src = thumbnailUrl;
      img.alt = '';
      preview.appendChild(img);
    }

    const title = data.get('title');
    if (title) preview.appendChild(el('div', 'title', title));

    const description = data.get('description');
    if (description) preview.appendChild(el('div', 'desc', description));

    const names = data.getAll('fieldName[]');
    const values = data.getAll('fieldValue[]');
    const inlines = data.getAll('fieldInline[]');
    const rows = names.map((n, i) => ({ name: n, value: values[i], inline: inlines[i] === 'true' })).filter((f) => f.name || f.value);
    if (rows.length) {
      const wrap = el('div', 'fields' + (rows.some((f) => f.inline) ? ' has-inline' : ''));
      rows.forEach((f) => {
        const fieldEl = el('div', 'field');
        fieldEl.appendChild(el('div', 'field-name', f.name));
        fieldEl.appendChild(el('div', 'field-value', f.value));
        wrap.appendChild(fieldEl);
      });
      preview.appendChild(wrap);
    }

    const imageUrl = data.get('imageUrl');
    if (imageUrl) {
      const img = document.createElement('img');
      img.className = 'image';
      img.src = imageUrl;
      img.alt = '';
      preview.appendChild(img);
    }

    const footerText = data.get('footerText');
    const footerIconUrl = data.get('footerIconUrl');
    if (footerText) {
      const row = el('div', 'footer');
      if (footerIconUrl) {
        const img = document.createElement('img');
        img.src = footerIconUrl;
        img.alt = '';
        row.appendChild(img);
      }
      row.appendChild(document.createTextNode(footerText));
      preview.appendChild(row);
    }

    if (!preview.childElementCount) {
      preview.appendChild(el('div', 'desc', 'Nothing to preview yet — fill in a title or description.'));
    }
  }

  form.addEventListener('input', renderPreview);
  form.addEventListener('change', renderPreview);
  fieldsContainer.addEventListener('input', renderPreview);

  const RULES_TEMPLATE = {
    title: '📜 Server Rules',
    description: 'Please read and follow these rules to keep this server friendly and safe for everyone.',
    color: '#ed4245',
    footerText: 'Thanks for being part of our community!',
    fields: [
      { name: '1️⃣ Be Respectful', value: "Treat everyone with respect. No harassment, hate speech, or personal attacks." },
      { name: '2️⃣ No Spam', value: 'Avoid excessive messages, emojis, or repeated content.' },
      { name: '3️⃣ Stay On-Topic', value: "Keep discussions relevant to the channel you're in." },
      { name: '4️⃣ No NSFW Content', value: 'Keep all content appropriate for all audiences.' },
      { name: '5️⃣ Follow Discord ToS', value: "Abide by Discord's Terms of Service and Community Guidelines." },
    ],
  };

  const loadRulesBtn = document.getElementById('load-rules-template');
  if (loadRulesBtn) {
    loadRulesBtn.addEventListener('click', () => {
      document.getElementById('title').value = RULES_TEMPLATE.title;
      document.getElementById('description').value = RULES_TEMPLATE.description;
      document.getElementById('color').value = RULES_TEMPLATE.color;
      document.getElementById('footerText').value = RULES_TEMPLATE.footerText;

      fieldsContainer.innerHTML = '';
      RULES_TEMPLATE.fields.forEach((f) => {
        const row = fieldRowTemplate();
        row.querySelector('[name="fieldName[]"]').value = f.name;
        row.querySelector('[name="fieldValue[]"]').value = f.value;
        fieldsContainer.appendChild(row);
      });

      renderPreview();
    });
  }

  renderPreview();
})();
