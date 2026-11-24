/* reviews.js — Reviews & Feedback: write, read everyone's, and manage your own */
(function () {
    const { $, esc } = UI;
    const TYPES = { compliment: ['Compliment', 'ok'], suggestion: ['Suggestion', 'warn'], complaint: ['Complaint', 'out'] };
    let type = 'compliment';
    let ftype = 'all';
    let editing = null;                                 // id of the review being edited

    /* ----- tabs ----- */
    function showTab(name) {
        document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
        $('#paneWrite').hidden = name !== 'write';
        $('#paneAll').hidden = name !== 'all';
        $('#paneMine').hidden = name !== 'mine';
        if (name === 'all') drawAll();
        if (name === 'mine') drawMine();
    }
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

    /* ----- one review ----- */
    function reviewHtml(r, { mine } = {}) {
        const it = DB.item(r.targetId);
        const [label, tone] = TYPES[r.type] || TYPES.compliment;
        const isMine = r.email === DB.me().email;
        const n = DB.helpfulCount(r.id);
        const isEditing = Boolean(mine) && editing === r.id;
        return `<article class="review">
            <div class="review-head">
                <span class="rv-avatar">${esc((r.author || '?')[0].toUpperCase())}</span>
                <div class="rv-who"><strong>${esc(r.author)}${isMine ? ' <span class="badge tag">You</span>' : ''}</strong><small>${UI.date(r.date)}${r.edited ? ' · edited' : ''}</small></div>
                <span class="badge ${tone}">${label}</span>
            </div>
            <p class="review-about">About <a href="${UI.urlOf(it)}">${esc(it.name)}</a> <span class="badge tag">${DB.isProduct(it) ? 'Product' : 'Store'}</span></p>
            ${isEditing
                ? `<textarea class="input" id="editText" maxlength="300">${esc(r.text)}</textarea>
                   <div class="review-foot"><button class="btn sm" data-saveedit="${esc(r.id)}">Save</button><button class="btn sm ghost" data-canceledit>Cancel</button></div>`
                : `<p class="review-text">${esc(r.text)}</p>
                   <div class="review-foot">
                       <button class="helpful${DB.iFoundHelpful(r.id) ? ' on' : ''}" data-helpful="${esc(r.id)}" ${isMine ? 'disabled title="You cannot vote on your own review"' : ''}>👍 Helpful · ${n}</button>
                       ${mine ? `<span class="spacer"></span><button class="btn sm ghost" data-edit="${esc(r.id)}">Edit</button><button class="btn sm danger" data-delete="${esc(r.id)}">Delete</button>` : ''}
                   </div>`}
        </article>`;
    }

    /* ----- write ----- */
    function fillTargets(keep) {
        const kind = $('#kind').value;
        const list = kind === 'store' ? DB.stores() : DB.products();
        $('#target').innerHTML = list.length
            ? list.map((x) => `<option value="${esc(x.id)}">${esc(DB.isProduct(x) ? `${x.name} — ${(DB.storeOf(x) || {}).name}` : x.name)}</option>`).join('')
            : '<option value="">Nothing to review yet</option>';
        if (keep && list.some((x) => x.id === keep)) $('#target').value = keep;
    }

    $('#kind').addEventListener('change', () => fillTargets());
    $('#typeChips').addEventListener('click', (e) => {
        const b = e.target.closest('[data-type]'); if (!b) return;
        type = b.dataset.type;
        document.querySelectorAll('#typeChips .chip').forEach((c) => c.classList.toggle('active', c === b));
    });
    $('#text').addEventListener('input', () => { $('#counter').textContent = `${$('#text').value.length} / 300`; });

    $('#reviewForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const text = $('#text').value.trim(), target = $('#target').value;
        const err = $('#formError');
        if (!target) return (err.textContent = 'There is nothing to review yet.');
        if (text.length < 10) return (err.textContent = 'Please write at least 10 characters.');
        err.textContent = '';
        DB.addReview({ targetId: target, type, text });
        $('#text').value = '';
        $('#counter').textContent = '0 / 300';
        counts();
        UI.toast('Thanks! Your review was posted.');
        showTab('mine');
    });

    /* ----- everyone's reviews ----- */
    function fillFilter() {
        const keep = $('#filterTarget').value || 'all';
        $('#filterTarget').innerHTML = `<option value="all">All stores and products</option>
            <optgroup label="Stores">${DB.stores().map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</optgroup>
            <optgroup label="Products">${DB.products().map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</optgroup>`;
        $('#filterTarget').value = [...$('#filterTarget').options].some((o) => o.value === keep) ? keep : 'all';
    }

    function drawAll() {
        fillFilter();
        let list = DB.reviewsAll();
        const t = $('#filterTarget').value;
        if (t !== 'all') list = list.filter((r) => r.targetId === t);
        if (ftype !== 'all') list = list.filter((r) => r.type === ftype);
        list.sort($('#sortReviews').value === 'helpful'
            ? (a, b) => DB.helpfulCount(b.id) - DB.helpfulCount(a.id) || b.date.localeCompare(a.date)
            : (a, b) => b.date.localeCompare(a.date));
        $('#allList').innerHTML = list.length ? list.map((r) => reviewHtml(r)).join('')
            : UI.emptyBox('No reviews yet', 'Be the first to share your experience.', 'fa-comment-dots');
    }

    function drawMine() {
        const list = DB.myReviews();
        $('#mineList').innerHTML = list.length ? list.map((r) => reviewHtml(r, { mine: true })).join('')
            : UI.emptyBox('You have not written a review yet', 'Use the “Write a review” tab to share your experience.', 'fa-pen');
    }

    const counts = () => { $('#mineCount').textContent = DB.myReviews().length; };
    const redraw = () => { counts(); drawAll(); drawMine(); };

    document.addEventListener('click', (e) => {
        const t = (sel) => e.target.closest(sel);
        if (t('[data-ftype]')) {
            ftype = t('[data-ftype]').dataset.ftype;
            document.querySelectorAll('#filterType .chip').forEach((c) => c.classList.toggle('active', c.dataset.ftype === ftype));
            return drawAll();
        }
        if (t('[data-helpful]')) { if (DB.toggleHelpful(t('[data-helpful]').dataset.helpful)) redraw(); return; }
        if (t('[data-edit]')) { editing = t('[data-edit]').dataset.edit; return redraw(); }
        if (t('[data-canceledit]')) { editing = null; return redraw(); }
        if (t('[data-saveedit]')) {
            const text = $('#editText').value.trim();
            if (text.length < 10) return UI.toast('Please write at least 10 characters.');
            DB.updateReview(t('[data-saveedit]').dataset.saveedit, text);
            editing = null; UI.toast('Review updated.'); return redraw();
        }
        if (t('[data-delete]')) {
            if (!confirm('Delete this review?')) return;
            DB.deleteReview(t('[data-delete]').dataset.delete);
            UI.toast('Review deleted.'); redraw();
        }
    });
    ['#filterTarget', '#sortReviews'].forEach((s) => $(s).addEventListener('change', drawAll));
    DB.onChange(() => { fillTargets($('#target').value); redraw(); });

    /* ----- start (a ?target=ID link opens the form for that store or product) ----- */
    const want = UI.param('target');
    if (want && DB.product(want)) $('#kind').value = 'product';
    fillTargets(want);
    counts();
    showTab('write');
})();
