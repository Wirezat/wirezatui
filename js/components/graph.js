/* wirezat-ui-v1 / js/components/graph.js
   Factory: renders a layered directed graph into a scrollable, drag-pannable
   board with a fullscreen toggle. Result (level 0) sits on the RIGHT, inputs
   flow in from the left. Handles shared nodes (multiple in-edges) and
   back-edges (cycles) — the input is a graph, not a tree.

   Usage:
     import { renderGraph } from '/ui/js/components/graph.js'

     renderGraph(parentEl, {
       nodes: [{ id, level, title, subtitle?, badge?, kind?, warn?, attrs?, labels?,
                  dependsOn?: [{ to, dashed?, title? }] }],
       //   dependsOn replaces the old separate edges[] array — each node
       //   declares its own dependencies (consumer→dependency), matching how
       //   the real domain data already looks (a recipe/item knows its own
       //   inputs). The internal flat edge list is derived once at the top
       //   of this function; everything below is otherwise unchanged.
       //   level: 0 = root/result. Nodes are pushed to their DEEPEST position
       //   reachable via edges (longest path), so shared inputs sit at the
       //   deepest level that uses them and multi-edges stay readable.
       //   kind: '' | 'primary' | 'terminal' | 'muted' | 'tagged' — primary
       //   is now a 1px accent border (was 2px — fixed, violated the
       //   1px-border-only rule).
       //   labels: [{ text, menu?, muted?, cls? }] — hover is a color
       //   transition now (muted→accent), never a background.
     }, {
       fullscreenLabel: 'Fullscreen',
       onMenuAction: (node, action) => {},
     })
*/

import { openPopover } from './popover.js'

export function renderGraph(parent, { nodes = [] } = {}, {
    fullscreenLabel = '',
    onMenuAction = () => {},
} = {}) {
    parent.innerHTML = ''

    // Derive the flat edge list the rest of this file already expects —
    // callers declare dependencies per-node (mirrors the real domain shape:
    // every recipe/item already knows its own inputs), this is the only
    // place that flattens it. No other logic below this line changes.
    const edges = nodes.flatMap(n =>
        (n.dependsOn || []).map(d => ({ from: n.id, to: d.to, dashed: d.dashed, title: d.title }))
    )

    const NODE_W = 190, MIN_NODE_H = 58, COL_GAP = 70, ROW_GAP = 14, PAD = 18

    function nodeContentHTML(n) {
        return `
            <div class="graph-node-title">${esc(n.title)}</div>
            ${n.subtitle ? `<div class="graph-node-subtitle">${esc(n.subtitle)}</div>` : ''}
            ${n.badge    ? `<div class="graph-node-badge">${esc(n.badge)}</div>` : ''}
            ${(n.labels || []).map((l, i) => `<div class="graph-node-label${l.muted ? ' muted' : ''}${l.cls ? ' ' + l.cls : ''}" data-label-idx="${i}">${esc(l.text)}</div>`).join('')}`
    }
    function nodeClass(n) {
        return 'graph-node'
            + (n.kind ? n.kind.split(' ').map(k => ' graph-node-' + k).join('') : '')
            + (n.warn ? ' graph-node-warn' : '')
    }

    // Measure each node's real height from its actual content (title/subtitle/
    // badge/labels can each wrap to multiple lines) — the card is exactly as
    // tall as it needs to be, never clipped, never oversized.
    const probeContainer = document.createElement('div')
    probeContainer.style.cssText = `position:fixed; visibility:hidden; left:-9999px; top:-9999px;`
    document.body.appendChild(probeContainer)
    const probes = nodes.map(n => {
        const el = document.createElement('div')
        el.style.width = NODE_W + 'px'
        el.className = nodeClass(n)
        el.innerHTML = nodeContentHTML(n)
        probeContainer.appendChild(el)
        return { n, el }
    })
    const nodeH = new Map()
    for (const { n, el } of probes) {
        nodeH.set(n.id, Math.max(MIN_NODE_H, el.offsetHeight))
    }
    probeContainer.remove()

    // ── Deepen levels: longest path from the root side ────────────────────────
    // Callers pass BFS levels (first-visit depth). For layout we want each node
    // at the DEEPEST level any consumer implies (consumer.level + 1), so an item
    // used on levels 2 and 3 renders at 3. Relaxation passes, capped to node
    // count, so cycles can't loop forever (back-edges simply stop relaxing).
    const depth = new Map(nodes.map(n => [n.id, n.level]))
    const nodeIds = new Set(depth.keys())
    const relaxEdges = edges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to))
    for (let pass = 0; pass < nodes.length; pass++) {
        let changed = false
        for (const e of relaxEdges) {
            const want = depth.get(e.from) + 1
            if (want > depth.get(e.to) && want < nodes.length) {
                depth.set(e.to, want)
                changed = true
            }
        }
        if (!changed) break
    }

    // ── Column assignment + crossing-reduction ordering ──────────────────────
    const byLevel = new Map()
    for (const n of nodes) {
        const lv = depth.get(n.id)
        if (!byLevel.has(lv)) byLevel.set(lv, [])
        byLevel.get(lv).push(n)
    }
    const levels = [...byLevel.keys()].sort((a, b) => a - b)

    // consumers[to] = list of node ids that depend on it (edge.from)
    const consumers = new Map()
    for (const e of edges) {
        if (!consumers.has(e.to)) consumers.set(e.to, [])
        consumers.get(e.to).push(e.from)
    }

    // Single barycenter pass, shallow→deep: order each column by the average
    // row index of its already-placed consumers to reduce edge crossings.
    const rowIdx = new Map()
    for (const lv of levels) {
        const col = byLevel.get(lv)
        if (rowIdx.size) {
            col.sort((a, b) => bary(a) - bary(b))
        }
        col.forEach((n, i) => rowIdx.set(n.id, i))
    }
    function bary(n) {
        const cs = (consumers.get(n.id) || []).map(id => rowIdx.get(id)).filter(v => v !== undefined)
        if (!cs.length) return rowIdx.get(n.id) ?? 0
        return cs.reduce((s, v) => s + v, 0) / cs.length
    }

    // ── Positions — level 0 (result) on the RIGHT, deeper levels leftward.
    // Row height is per-node (measured above), so columns stack at whatever
    // height each card actually needs. ────────────────────────────────────────
    const pos = new Map()
    let maxColHeight = 0
    const nCols = levels.length
    levels.forEach((lv, ci) => {
        const col = byLevel.get(lv)
        const x = PAD + (nCols - 1 - ci) * (NODE_W + COL_GAP)
        let y = PAD
        col.forEach(n => {
            const h = nodeH.get(n.id)
            pos.set(n.id, { x, y, h })
            y += h + ROW_GAP
        })
        maxColHeight = Math.max(maxColHeight, y - ROW_GAP + PAD)
    })
    const width  = nCols ? PAD * 2 + nCols * NODE_W + (nCols - 1) * COL_GAP : 0
    const height = nCols ? maxColHeight : 0

    // ── Board: toolbar (fullscreen) + drag-pannable canvas ────────────────────
    const board = document.createElement('div')
    board.className = 'graph-board'

    const fsBtn = document.createElement('button')
    fsBtn.className = 'graph-fs-btn'
    fsBtn.type = 'button'
    fsBtn.textContent = '⛶'
    if (fullscreenLabel) fsBtn.title = fullscreenLabel
    board.appendChild(fsBtn)

    const canvas = document.createElement('div')
    canvas.className = 'graph-canvas'
    const inner = document.createElement('div')
    inner.className = 'graph-inner'
    inner.style.width  = width + 'px'
    inner.style.height = height + 'px'
    canvas.appendChild(inner)
    board.appendChild(canvas)


    // Drag-to-pan: press on empty canvas (not a node) and drag. A small
    // movement threshold keeps plain clicks working as clicks.
    let drag = null
    canvas.addEventListener('pointerdown', e => {
        if (e.target.closest('.graph-node') || e.target.closest('.graph-fs-btn')) return
        drag = { x: e.clientX, y: e.clientY, sl: canvas.scrollLeft, st: canvas.scrollTop, moved: false }
        canvas.setPointerCapture(e.pointerId)
    })
    canvas.addEventListener('pointermove', e => {
        if (!drag) return
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) {
            drag.moved = true
            canvas.classList.add('panning')
        }
        if (drag.moved) {
            canvas.scrollLeft = drag.sl - dx
            canvas.scrollTop  = drag.st - dy
        }
    })
    let justPanned = false
    const endDrag = () => {
        if (drag?.moved) justPanned = true
        drag = null
        canvas.classList.remove('panning')
    }
    canvas.addEventListener('pointerup', endDrag)
    canvas.addEventListener('pointercancel', endDrag)

    // Fullscreen: overlay the app's main container (not the system fullscreen
    // API). Position is matched to .main's rect and re-applied on resize.
    function applyFsRect() {
        const main = document.querySelector('.main')
        const r = main ? main.getBoundingClientRect() : null
        if (r) {
            board.style.top    = r.top + 'px'
            board.style.left   = r.left + 'px'
            board.style.width  = r.width + 'px'
            board.style.height = r.height + 'px'
        } else {
            board.style.inset = '0'
        }
    }
    function setFullscreen(on) {
        board.classList.toggle('graph-board-fs', on)
        if (on) {
            applyFsRect()
            window.addEventListener('resize', applyFsRect)
            document.addEventListener('keydown', escExit)
        } else {
            board.style.top = board.style.left = board.style.width = board.style.height = board.style.inset = ''
            window.removeEventListener('resize', applyFsRect)
            document.removeEventListener('keydown', escExit)
        }
    }
    const escExit = e => { if (e.key === 'Escape') setFullscreen(false) }
    fsBtn.addEventListener('click', () => setFullscreen(!board.classList.contains('graph-board-fs')))

    // ── Edges (SVG underlay) — flow arrows point dependency → consumer ───────
    const svgNS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(svgNS, 'svg')
    svg.setAttribute('class', 'graph-edges')
    svg.setAttribute('width', width)
    svg.setAttribute('height', height)

    const defs = document.createElementNS(svgNS, 'defs')
    const marker = document.createElementNS(svgNS, 'marker')
    marker.setAttribute('id', 'graph-arrow')
    marker.setAttribute('viewBox', '0 0 8 8')
    marker.setAttribute('refX', '7')
    marker.setAttribute('refY', '4')
    marker.setAttribute('markerWidth', '7')
    marker.setAttribute('markerHeight', '7')
    marker.setAttribute('orient', 'auto-start-reverse')
    const tip = document.createElementNS(svgNS, 'path')
    tip.setAttribute('d', 'M0,0 L8,4 L0,8 z')
    tip.setAttribute('fill', 'currentColor')
    marker.appendChild(tip)
    defs.appendChild(marker)
    svg.appendChild(defs)

    // Port assignment: instead of every edge meeting a node at its vertical
    // center (arrow spaghetti on shared nodes), spread attachment points along
    // the node edge — in-edges along the consumer's left side, out-edges along
    // the dependency's right side — ordered by the other endpoint's y so lines
    // don't cross right at the node.
    const inPorts  = new Map()  // consumer id  → its edges, sorted by dependency y
    const outPorts = new Map()  // dependency id → its edges, sorted by consumer y
    const drawable = edges.filter(e => pos.has(e.from) && pos.has(e.to))
    for (const e of drawable) {
        if (!inPorts.has(e.from)) inPorts.set(e.from, [])
        inPorts.get(e.from).push(e)
        if (!outPorts.has(e.to)) outPorts.set(e.to, [])
        outPorts.get(e.to).push(e)
    }
    for (const list of inPorts.values())  list.sort((a, b) => pos.get(a.to).y - pos.get(b.to).y)
    for (const list of outPorts.values()) list.sort((a, b) => pos.get(a.from).y - pos.get(b.from).y)
    function portY(nodeY, nodeHeight, idx, count) {
        return nodeY + nodeHeight * (idx + 1) / (count + 1)
    }

    const edgeEls = [] // { edge, path } — kept for highlight toggling below
    for (const e of drawable) {
        const pf = pos.get(e.from), pt = pos.get(e.to)
        // Material flows dependency (to) → consumer (from). Dependencies sit to
        // the LEFT of their consumer; back-edges (cycles) are the exception and
        // get a stronger curve so they stay readable.
        const outs = outPorts.get(e.to)
        const ins  = inPorts.get(e.from)
        const x1 = pt.x + NODE_W, y1 = portY(pt.y, pt.h, outs.indexOf(e), outs.length)  // dependency right edge
        const x2 = pf.x,          y2 = portY(pf.y, pf.h, ins.indexOf(e),  ins.length)   // consumer left edge
        const back = x1 >= x2
        const bend = back ? Math.max(50, (x1 - x2) / 2 + 50) : Math.max(28, (x2 - x1) / 2)
        const d = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`
        const path = document.createElementNS(svgNS, 'path')
        path.setAttribute('d', d)
        path.setAttribute('class', 'graph-edge' + (e.dashed ? ' dashed' : '') + (back ? ' back' : ''))
        path.setAttribute('marker-end', 'url(#graph-arrow)')
        if (e.title) {
            const titleEl = document.createElementNS(svgNS, 'title')
            titleEl.textContent = e.title
            path.appendChild(titleEl)
        }
        svg.appendChild(path)
        edgeEls.push({ edge: e, path })
    }
    inner.appendChild(svg)

    // ── Nodes ─────────────────────────────────────────────────────────────────
    const nodeEls = new Map() // id → element, for highlight toggling below
    for (const n of nodes) {
        const p = pos.get(n.id)
        const el = document.createElement('div')
        el.className = nodeClass(n)
        el.dataset.nodeId = n.id
        el.style.left   = p.x + 'px'
        el.style.top    = p.y + 'px'
        el.style.width  = NODE_W + 'px'
        el.style.height = p.h + 'px'
        for (const [k, v] of Object.entries(n.attrs ?? {})) el.setAttribute(k, v)

        el.innerHTML = nodeContentHTML(n)

        el.querySelectorAll('.graph-node-label').forEach(labelEl => {
            const label = (n.labels || [])[Number(labelEl.dataset.labelIdx)]
            if (!label?.menu?.length) return
            labelEl.classList.add('clickable')
            labelEl.addEventListener('click', e => {
                e.stopPropagation()
                openPopover(labelEl, label.menu, { onSelect: action => onMenuAction(n, action) })
            })
        })

        nodeEls.set(n.id, el)
        inner.appendChild(el)
    }

    parent.appendChild(board)

    // ── Path highlight — click a node to dim everything not on its path
    // (transitive dependencies + transitive consumers); click again, a
    // different node, or empty canvas to clear. Pure graph traversal, no
    // domain meaning — same edges the layout above already uses. ─────────────
    let highlightedId = null
    function pathThrough(id) {
        const path = new Set([id])
        const pathEdges = new Set()
        for (const [from, to] of [['from', 'to'], ['to', 'from']]) {
            const stack = [id]
            while (stack.length) {
                const cur = stack.pop()
                for (const e of edges) {
                    if (e[from] !== cur) continue
                    pathEdges.add(e)
                    if (!path.has(e[to])) { path.add(e[to]); stack.push(e[to]) }
                }
            }
        }
        return { path, pathEdges }
    }
    function setHighlight(id) {
        highlightedId = id
        if (!id) {
            nodeEls.forEach(el => el.classList.remove('graph-node-dim', 'graph-node-selected'))
            edgeEls.forEach(({ path }) => path.classList.remove('graph-edge-dim'))
            return
        }
        const { path, pathEdges } = pathThrough(id)
        nodeEls.forEach((el, nid) => {
            el.classList.toggle('graph-node-dim', !path.has(nid))
            el.classList.toggle('graph-node-selected', nid === id)
        })
        edgeEls.forEach(({ edge, path: pathEl }) => pathEl.classList.toggle('graph-edge-dim', !pathEdges.has(edge)))
    }
    inner.addEventListener('click', e => {
        if (e.target.closest('.graph-node-label')) return
        const nodeEl = e.target.closest('.graph-node')
        if (!nodeEl) return
        const id = nodeEl.dataset.nodeId
        setHighlight(highlightedId === id ? null : id)
    })
    canvas.addEventListener('click', e => {
        if (justPanned) { justPanned = false; return }
        if (!e.target.closest('.graph-node')) setHighlight(null)
    })

    // Only show the grab/pan cursor when the graph actually overflows the
    // visible canvas — an empty-looking hand cursor on a fully-visible graph
    // is misleading since there's nothing to pan.
    const updateScrollable = () => {
        canvas.classList.toggle('scrollable', canvas.scrollWidth > canvas.clientWidth || canvas.scrollHeight > canvas.clientHeight)
    }
    updateScrollable()
    // Attached to the returned root element so callers that replace content
    // (e.g. container.js's setContent) can disconnect it before detaching —
    // otherwise this observer keeps a strong reference to a detached canvas
    // forever, once per render.
    board._resizeObserver = new ResizeObserver(updateScrollable)
    board._resizeObserver.observe(canvas)

    return board
}

function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
