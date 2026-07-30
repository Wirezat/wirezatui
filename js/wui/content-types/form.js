/* wirezat-ui-v1 / js/wui/content-types/form.js
   wui content-type "form": builds a field list from data config.
   Covers text, textarea, select, checkbox, radio-group. Additional field
   types follow the same pattern in _buildField when needed.

   Usage:
     import { render } from '/js/wui/content-types/form.js'
     const { el, values } = render({
       fields: [
         { type: 'text', key: 'name', labelKey: 'save.field.name' },
         { type: 'checkbox', key: 'active', labelKey: 'save.field.active' },
       ],
       actions: [{ labelKey: 'common.save', variant: 'primary', onClick: () => console.log(values()) }],
     })
*/

import { t } from '../../i18n.js'

export function render(content) {
    const host = document.createElement('div')
    let inputs = {}

    function build(cfg) {
        host.innerHTML = ''
        inputs = {}
        ;(cfg.fields ?? []).forEach(f => host.appendChild(_buildField(f, inputs)))

        if (cfg.actions?.length) {
            const bar = document.createElement('div')
            bar.className = 'form-actions'
            cfg.actions.forEach(a => {
                const btn = document.createElement('button')
                btn.type = 'button'
                btn.className = 'btn btn-sm ' + (a.variant === 'primary' ? 'btn-primary'
                    : a.variant === 'danger' ? 'btn-danger' : 'btn-ghost')
                btn.textContent = t(a.labelKey)
                btn.addEventListener('click', () => a.onClick?.(values()))
                bar.appendChild(btn)
            })
            host.appendChild(bar)
        }
    }

    function values() {
        const out = {}
        for (const [key, getVal] of Object.entries(inputs)) out[key] = getVal()
        return out
    }

    build(content)
    return {
        el: host,
        update(partial) { build({ ...content, ...partial }) },
        values,
    }
}

function _buildField(f, inputs) {
    const wrap = document.createElement('div')
    wrap.className = 'field'

    const label = document.createElement('label')
    label.className = 'field-label'
    label.textContent = t(f.labelKey)
    wrap.appendChild(label)

    if (f.type === 'textarea') {
        const el = document.createElement('textarea')
        el.className = 'textarea'
        el.value = f.value ?? ''
        if (f.onChange) el.addEventListener('input', () => f.onChange(el.value))
        inputs[f.key] = () => el.value
        wrap.appendChild(el)
    } else if (f.type === 'select') {
        const el = document.createElement('select')
        el.className = 'select'
        ;(f.options ?? []).forEach(opt => {
            const o = document.createElement('option')
            o.value = opt.value ?? opt
            o.textContent = opt.labelKey ? t(opt.labelKey) : String(opt)
            el.appendChild(o)
        })
        if (f.value != null) el.value = f.value
        if (f.onChange) el.addEventListener('change', () => f.onChange(el.value))
        inputs[f.key] = () => el.value
        wrap.appendChild(el)
    } else if (f.type === 'checkbox') {
        const item = document.createElement('label')
        item.className = 'check-item'
        const cb = document.createElement('input')
        cb.type = 'checkbox'
        cb.checked = !!f.value
        if (f.onChange) cb.addEventListener('change', () => f.onChange(cb.checked))
        item.appendChild(cb)
        item.appendChild(document.createTextNode(t(f.labelKey)))
        inputs[f.key] = () => cb.checked
        wrap.removeChild(label) // checkbox carries its own label
        wrap.appendChild(item)
    } else if (f.type === 'radio-group') {
        const group = document.createElement('div')
        group.className = 'radio-group'
        const name = `wui-radio-${f.key}-${Math.random().toString(36).slice(2, 8)}`
        ;(f.options ?? []).forEach(opt => {
            const optLabel = document.createElement('label')
            optLabel.className = 'radio-opt'
            const radio = document.createElement('input')
            radio.type = 'radio'
            radio.name = name
            radio.value = opt.value ?? opt
            radio.checked = (opt.value ?? opt) === f.value
            if (f.onChange) radio.addEventListener('change', () => f.onChange(radio.value))
            optLabel.appendChild(radio)
            optLabel.appendChild(document.createTextNode(opt.labelKey ? t(opt.labelKey) : String(opt)))
            group.appendChild(optLabel)
        })
        inputs[f.key] = () => group.querySelector('input:checked')?.value
        wrap.appendChild(group)
    } else {
        const el = document.createElement('input')
        el.className = 'input'
        el.type = 'text'
        el.value = f.value ?? ''
        if (f.onChange) el.addEventListener('input', () => f.onChange(el.value))
        inputs[f.key] = () => el.value
        wrap.appendChild(el)
    }

    return wrap
}
