/* wirezat-ui-v1 / js/table-features.js
   Opt-in table features: hidden rows toggle, cell-clamp scroll.

   initHiddenRows(scope?)
     Wires all [data-wui-hidden-toggle] buttons to their nearest
     .table-has-hidden ancestor. Tables opt-in by having .table-has-hidden
     on the <table> element; rows opt-in with .row-hidden.

   initCellClampScroll(scope?)
     Detects overflow in .cell-clamp.cell-clamp--scroll elements, doubles
     the text in .cell-clamp-inner for seamless marquee, and sets .overflows.
     Call after rows are rendered into the DOM.
*/

export function initHiddenRows(scope = document) {
    scope.querySelectorAll('[data-wui-hidden-toggle]').forEach(btn => {
        const table = btn.closest('.table-has-hidden')
            ?? btn.closest('[data-wui-hidden-table]')?.querySelector('.table-has-hidden');
        if (!table) return;

        btn.addEventListener('click', () => {
            const show = table.classList.toggle('show-hidden');
            btn.classList.toggle('active', show);
        });
    });
}

/**
 * initClickToEdit(scope?)
 * Wires all .td-editable cells (skipping [data-wui-bulk-row]).
 * Click → .editing; Enter/Blur → commit + dispatch wui:cell-write bubbling up.
 * Safe to call multiple times — skips already-wired cells via data-wui-edit-init.
 */
export function initClickToEdit(scope = document) {
    scope.querySelectorAll('.td-editable').forEach(cell => {
        if (cell.closest('[data-wui-bulk-row]')) return;
        if (cell.dataset.wuiEditInit) return;
        cell.dataset.wuiEditInit = '1';

        const valEl = cell.querySelector('.td-val');
        const input = cell.querySelector('.td-input');
        if (!valEl || !input) return;

        cell.addEventListener('click', e => {
            e.stopPropagation();
            if (cell.classList.contains('editing')) return;
            input.value = valEl.textContent;
            cell.classList.add('editing');
            input.focus();
            input.select();
        });

        function commit() {
            if (!cell.classList.contains('editing')) return;
            cell.classList.remove('editing');
            const val = input.value.trim();
            if (!val || val === valEl.textContent) { input.value = valEl.textContent; return; }
            const prev = valEl.textContent;
            valEl.textContent = val;
            cell.dispatchEvent(new CustomEvent('wui:cell-write', {
                bubbles: true,
                detail: { field: cell.dataset.wuiField ?? null, value: val, prev, row: cell.closest('tr') },
            }));
        }

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter')  { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { input.value = valEl.textContent; cell.classList.remove('editing'); }
        });
        input.addEventListener('blur', commit);
    });
}

/**
 * initBulkRow(table)
 * Manages tr[data-wui-bulk-row] inside the table.
 * Tracks row checkboxes → toggles table.bulk-active + updates [data-bulk-count].
 * [data-bulk-count] supports a data-bulk-count-tpl="text with {n}" attribute.
 * .td-editable cells in the bulk row get click-to-edit; on commit dispatches
 * wui:bulk-write on the table for each checked row.
 * data-wui-bulk-enumerate on a .td-editable → appends _{index+1} to each value.
 *
 * Returns { refresh } — call refresh() after programmatic checkbox changes.
 */
export function initBulkRow(table) {
    const bulkRow = table.querySelector('tr[data-wui-bulk-row]');
    if (!bulkRow) return { refresh() {} };

    function checkedRows() {
        return [...table.querySelectorAll('tbody tr:not([data-wui-bulk-row]) input[type=checkbox]')]
            .filter(cb => cb.checked)
            .map(cb => cb.closest('tr'));
    }

    function updateCount() {
        const rows = checkedRows();
        const n = rows.length;
        table.classList.toggle('bulk-active', n > 0);
        bulkRow.querySelectorAll('[data-bulk-count]').forEach(el => {
            el.textContent = (el.dataset.bulkCountTpl ?? '{n}').replace('{n}', String(n));
        });
        if (n === 0) bulkRow.querySelectorAll('.td-editable').forEach(c => c.classList.remove('editing'));
    }

    if (!table.dataset.wuiBulkInit) {
        table.dataset.wuiBulkInit = '1';
        table.addEventListener('change', e => {
            if (e.target.closest('[data-wui-bulk-row]')) return;
            if (e.target.type === 'checkbox') updateCount();
        });
    }

    bulkRow.querySelectorAll('.td-editable').forEach(cell => {
        const input    = cell.querySelector('.td-input');
        const enumerate = 'wuiBulkEnumerate' in cell.dataset;
        if (!input) return;

        cell.addEventListener('click', e => {
            e.stopPropagation();
            cell.classList.add('editing');
            input.focus();
            input.select();
        });

        function applyWrite() {
            if (!cell.classList.contains('editing')) return;
            cell.classList.remove('editing');
            const val = input.value.trim();
            input.value = '';
            if (!val) return;
            const field = cell.dataset.wuiField ?? null;
            checkedRows().forEach((row, i) => {
                const written = enumerate ? val + '_' + (i + 1) : val;
                if (field) {
                    const target = row.querySelector(`.td-editable[data-wui-field="${CSS.escape(field)}"] .td-val`);
                    if (target) target.textContent = written;
                }
                table.dispatchEvent(new CustomEvent('wui:bulk-write', {
                    bubbles: true,
                    detail: { field, value: written, enumerate, row, index: i },
                }));
            });
        }

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter')  { e.preventDefault(); applyWrite(); }
            if (e.key === 'Escape') { input.value = ''; cell.classList.remove('editing'); }
        });
        input.addEventListener('blur', applyWrite);
    });

    return { refresh: updateCount };
}

/**
 * initCollapsibleGroups(table)
 * Wires click-to-collapse on tr.table-group-hd.collapsible rows via delegation.
 * Toggling a header sets display:none on sibling rows until the next group header.
 * Setting display:'' on uncollapse lets existing CSS rules (e.g. archived rows)
 * re-apply naturally.
 *
 * Opt-in editable mode: add data-group-editable to tr.table-group-hd.
 * - Click .group-hd-name → enter edit mode (.group-editing on tr)
 * - Enter/blur → commit → dispatches wui:group-rename { groupId, name, prev }
 * - Escape → cancel
 * - Click .group-hd-del → dispatches wui:group-delete { groupId }
 *
 * Safe to call once — skips already-wired tables via data-wui-collapsible-init.
 */
export function initCollapsibleGroups(table) {
    if (table.dataset.wuiCollapsibleInit) return;
    table.dataset.wuiCollapsibleInit = '1';

    table.addEventListener('click', e => {
        // Delete button
        if (e.target.closest('.group-hd-del')) {
            const hd = e.target.closest('tr.table-group-hd[data-group-editable]');
            if (!hd) return;
            e.stopPropagation();
            hd.dispatchEvent(new CustomEvent('wui:group-delete', {
                bubbles: true,
                detail: { groupId: hd.dataset.group },
            }));
            return;
        }

        // Enter edit mode via name click
        const nameEl = e.target.closest('.group-hd-name');
        if (nameEl) {
            const hd = nameEl.closest('tr.table-group-hd[data-group-editable]');
            if (hd && !hd.classList.contains('group-editing')) {
                e.stopPropagation();
                _enterGroupEdit(hd);
                return;
            }
        }

        // Collapse toggle — skip when row is in edit mode
        const hd = e.target.closest('tr.table-group-hd.collapsible');
        if (!hd || hd.classList.contains('group-editing')) return;
        hd.classList.toggle('collapsed');
        const collapsed = hd.classList.contains('collapsed');
        let sib = hd.nextElementSibling;
        while (sib && !sib.classList.contains('table-group-hd')) {
            const isSpacer = sib.classList.contains('row-spacer');
            sib.style.display = collapsed ? 'none' : '';
            sib = sib.nextElementSibling;
            if (isSpacer) break;
        }
    });
}

function _enterGroupEdit(hd) {
    const nameEl = hd.querySelector('.group-hd-name');
    const input  = hd.querySelector('.group-hd-input');
    if (!nameEl || !input) return;

    const original = nameEl.textContent;
    input.value = original;
    hd.classList.add('group-editing');
    input.focus();
    input.select();

    const ac = new AbortController();
    const { signal } = ac;

    function commit() {
        ac.abort();
        hd.classList.remove('group-editing');
        const val = input.value.trim();
        if (!val || val === original) return;
        nameEl.textContent = val;
        hd.dispatchEvent(new CustomEvent('wui:group-rename', {
            bubbles: true,
            detail: { groupId: hd.dataset.group, name: val, prev: original },
        }));
    }

    function cancel() {
        ac.abort();
        hd.classList.remove('group-editing');
        input.value = original;
    }

    input.addEventListener('blur', commit, { signal });
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter')  { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { cancel(); }
    }, { signal });
}

/**
 * initDraggableRows(table, opts?)
 * Native-drag-API reorder for table rows with cross-group support.
 *
 * Rows opt in with data-id="<uuid>". Group-header rows (tr.table-group-hd)
 * are drop targets but not draggable themselves. Row spacers are skipped.
 * A tr.wui-drop-zone-end at the end of tbody provides a drop target for
 * placing rows at the end of the ungrouped section.
 *
 * opts.handleSelector = '.drag-handle'
 * opts.rowSelector    = 'tr[data-id]:not(.table-group-hd)'
 *
 * Dispatches 'wui:row-reorder' (bubbles) on a successful drop:
 *   detail: { id, afterId, beforeId, toGroupId, afterGroupId, beforeGroupId }
 *   id             — data-id of the moved row
 *   afterId        — data-id of the nearest ungrouped/same-group sibling above, or null
 *   beforeId       — data-id of the nearest ungrouped/same-group sibling below, or null
 *   toGroupId      — target group id, or null (ungrouped)
 *   afterGroupId   — id of the group header immediately above when afterId is null
 *   beforeGroupId  — id of the group header immediately below when beforeId is null
 *
 * Safe to call once per table — re-calls are a no-op.
 * New rows added to tbody after init are wired automatically via MutationObserver.
 */
export function initDraggableRows(table, opts = {}) {
    if (table.dataset.wuiDraggableInit) return;
    table.dataset.wuiDraggableInit = '1';

    const handleSel = opts.handleSelector ?? '.drag-handle';
    const rowSel    = opts.rowSelector    ?? 'tr[data-id]:not(.table-group-hd)';
    const colCount  = table.querySelector('colgroup')?.children.length
                   ?? table.querySelector('thead tr')?.children.length
                   ?? 1;
    const tbody = table.querySelector('tbody');

    let dragId      = null;   // data-id of row being dragged
    let dragRow     = null;   // TR element being dragged
    let overRow     = null;   // TR element currently hovered as drop target
    let overEdge    = null;   // 'top' | 'bottom'
    let fromHandle  = false;
    let expandTimer = null;   // 600ms hover-expand timer for collapsed group headers

    function wireRows() {
        tbody.querySelectorAll(rowSel).forEach(row => {
            if (!row.dataset.wuiDragWired) {
                row.dataset.wuiDragWired = '1';
                row.draggable = true;
            }
        });
    }
    wireRows();
    new MutationObserver(wireRows).observe(tbody, { childList: true });

    table.addEventListener('pointerdown', e => {
        fromHandle = !!e.target.closest(handleSel);
    }, { capture: true });

    table.addEventListener('dragstart', e => {
        if (!fromHandle) { e.preventDefault(); return; }
        const row = e.target.closest(rowSel);
        if (!row) { e.preventDefault(); return; }

        dragId  = row.dataset.id;
        dragRow = row;
        row.classList.add('wui-drag-source');

        const tableRect = table.getBoundingClientRect();
        const rowRect   = row.getBoundingClientRect();
        const ghost = _buildDragGhost(table, row, colCount);
        Object.assign(ghost.style, { position: 'fixed', top: '-9999px', left: '0', width: tableRect.width + 'px' });
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, e.clientX - rowRect.left, e.clientY - rowRect.top);
        requestAnimationFrame(() => ghost.remove());
        e.dataTransfer.effectAllowed = 'move';
    });

    table.addEventListener('dragover', e => {
        if (!dragId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const target = e.target.closest('tr');
        if (!target || target === dragRow ||
            'wuiBulkRow' in target.dataset ||
            target.classList.contains('row-spacer') ||
            getComputedStyle(target).display === 'none') return;

        const isEndZone = 'wuiDropZoneEnd' in target.dataset;
        const isGroupHd = target.classList.contains('table-group-hd');

        // End-zone always shows a "top" indicator (line above the zone = after last row)
        let edge;
        if (isEndZone) {
            edge = 'top';
        } else {
            const rect = target.getBoundingClientRect();
            edge = e.clientY < rect.top + rect.height * 0.5 ? 'top' : 'bottom';
        }

        if (target !== overRow || edge !== overEdge) {
            _clearEdge();
            overRow  = target;
            overEdge = edge;
            target.classList.add(edge === 'top' ? 'wui-drop-edge-top' : 'wui-drop-edge-bottom');

            // Hover-expand: expand collapsed group on prolonged hover over bottom half
            if (isGroupHd && edge === 'bottom' && target.classList.contains('collapsed')) {
                expandTimer = setTimeout(() => {
                    expandTimer = null;
                    target.classList.remove('collapsed');
                    let sib = target.nextElementSibling;
                    while (sib && !sib.classList.contains('table-group-hd') &&
                           !('wuiDropZoneEnd' in sib.dataset)) {
                        sib.style.display = '';
                        if (sib.classList.contains('row-spacer')) break;
                        sib = sib.nextElementSibling;
                    }
                }, 600);
            }
        }
    });

    table.addEventListener('dragleave', e => {
        if (!table.contains(e.relatedTarget)) _clearEdge();
    });

    table.addEventListener('drop', e => {
        if (!dragId || !overRow) return;
        e.preventDefault();

        const id      = dragId;
        const tRow    = overRow;
        const edge    = overEdge;
        const isEndZone = 'wuiDropZoneEnd' in tRow.dataset;
        const isGroupHd = tRow.classList.contains('table-group-hd');

        _clearEdge();
        dragRow?.classList.remove('wui-drag-source');

        // 1. Move row in DOM and assign new group membership
        if (isEndZone) {
            // Place before end-zone marker → last item, ungrouped
            tRow.before(dragRow);
            delete dragRow.dataset.group;
        } else if (isGroupHd && edge === 'top') {
            // Ungrouped, positioned before this group
            tRow.before(dragRow);
            delete dragRow.dataset.group;
        } else if (isGroupHd && edge === 'bottom') {
            // First item inside this group
            tRow.after(dragRow);
            dragRow.dataset.group = tRow.dataset.group;
        } else {
            // Regular row: inherit target's group
            if (edge === 'top') tRow.before(dragRow);
            else                tRow.after(dragRow);
            if (tRow.dataset.group) dragRow.dataset.group = tRow.dataset.group;
            else                    delete dragRow.dataset.group;
        }

        // 2. Resolve neighbor IDs from final DOM position
        const { afterId, beforeId, toGroupId, afterGroupId, beforeGroupId } =
            _resolveFromDOM(tbody, dragRow);

        dragId = dragRow = overRow = overEdge = null;

        table.dispatchEvent(new CustomEvent('wui:row-reorder', {
            bubbles: true,
            detail: { id, afterId, beforeId, toGroupId, afterGroupId, beforeGroupId },
        }));
    });

    table.addEventListener('dragend', () => {
        _clearEdge();
        dragRow?.classList.remove('wui-drag-source');
        dragId = dragRow = overRow = overEdge = null;
    });

    function _clearEdge() {
        clearTimeout(expandTimer);
        expandTimer = null;
        overRow?.classList.remove('wui-drop-edge-top', 'wui-drop-edge-bottom');
        overRow  = null;
        overEdge = null;
    }
}

function _buildDragGhost(table, row, colCount) {
    const wrap = document.createElement('div');
    wrap.className = 'wui-drag-ghost';

    const gt = document.createElement('table');
    gt.className = table.className;
    const colgroup = table.querySelector('colgroup');
    if (colgroup) gt.appendChild(colgroup.cloneNode(true));

    const clone = row.cloneNode(true);
    clone.classList.remove('wui-drag-source');
    clone.querySelectorAll('input, button').forEach(el => {
        el.setAttribute('tabindex', '-1');
        el.setAttribute('aria-hidden', 'true');
    });

    const gtb = document.createElement('tbody');
    gtb.appendChild(clone);
    gt.appendChild(gtb);
    wrap.appendChild(gt);
    return wrap;
}

// Resolves afterId / beforeId / toGroupId / afterGroupId / beforeGroupId
// from the row's current DOM position (after the DOM move in the drop handler).
//
// toGroupId comes directly from row.dataset.group (set by the drop handler).
//
// For grouped rows: afterId/beforeId are PLs in the same group; group headers
// act as hard stops, spacers act as hard stops.
//
// For ungrouped rows: afterId/beforeId are other ungrouped PLs; group headers
// act as hard stops yielding afterGroupId/beforeGroupId instead.
function _resolveFromDOM(tbody, row) {
    const toGroupId = row.dataset.group ?? null;
    const isGrouped = toGroupId !== null;

    let afterId = null;
    for (let s = row.previousElementSibling; s; s = s.previousElementSibling) {
        if ('wuiBulkRow' in s.dataset ||
            s.classList.contains('table-group-hd') ||
            s.classList.contains('row-spacer')) break;
        if (s.dataset.id) {
            const sameScope = isGrouped
                ? (s.dataset.group ?? null) === toGroupId
                : !s.dataset.group;
            if (sameScope) { afterId = s.dataset.id; break; }
            break; // different group's PL — stop
        }
    }

    let beforeId = null;
    for (let s = row.nextElementSibling; s; s = s.nextElementSibling) {
        if ('wuiBulkRow' in s.dataset ||
            'wuiDropZoneEnd' in s.dataset ||
            s.classList.contains('table-group-hd') ||
            s.classList.contains('row-spacer')) break;
        if (s.dataset.id) {
            const sameScope = isGrouped
                ? (s.dataset.group ?? null) === toGroupId
                : !s.dataset.group;
            if (sameScope) { beforeId = s.dataset.id; break; }
            break;
        }
    }

    // For ungrouped rows: when no PL neighbor was found in a direction,
    // look for the nearest group header to use as a position reference.
    let afterGroupId = null, beforeGroupId = null;
    if (!isGrouped) {
        if (afterId === null) {
            for (let s = row.previousElementSibling; s; s = s.previousElementSibling) {
                if ('wuiBulkRow' in s.dataset) break;
                if (s.classList.contains('table-group-hd')) {
                    afterGroupId = s.dataset.group ?? null;
                    break;
                }
            }
        }
        if (beforeId === null) {
            for (let s = row.nextElementSibling; s; s = s.nextElementSibling) {
                if ('wuiDropZoneEnd' in s.dataset) break;
                if (s.classList.contains('table-group-hd')) {
                    beforeGroupId = s.dataset.group ?? null;
                    break;
                }
            }
        }
    }

    return { afterId, beforeId, toGroupId, afterGroupId, beforeGroupId };
}

export function initCellClampScroll(scope = document) {
    scope.querySelectorAll('.cell-clamp.cell-clamp--scroll').forEach(el => {
        const inner = el.querySelector('.cell-clamp-inner');
        if (!inner || inner.dataset.wuiScrollInit) return;
        inner.dataset.wuiScrollInit = '1';

        if (inner.scrollWidth > el.offsetWidth + 1) {
            const orig = inner.textContent;
            inner.textContent = orig + '   ' + orig;
            el.classList.add('overflows');
        }
    });
}
