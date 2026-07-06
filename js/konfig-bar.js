/* wirezat-ui-v1 / js/konfig-bar.js
   Konfig-bar toggle: ⚙ trigger opens/closes the collapsible controls bar.

   Expected HTML:
     <button class="konfig-trigger" data-konfig-trigger>⚙</button>
     <div class="konfig-bar" data-konfig-bar>…</div>

   Usage:
     initKonfigBar(scope?)
*/

export function initKonfigBar(scope = document) {
    scope.querySelectorAll('[data-konfig-trigger]').forEach(trigger => {
        const bar = trigger.closest('[data-page-header-area]')?.querySelector('[data-konfig-bar]')
                 ?? trigger.parentElement?.querySelector('[data-konfig-bar]');
        if (!bar) return;

        trigger.addEventListener('click', () => {
            const open = bar.classList.toggle('open');
            trigger.classList.toggle('open', open);
        });
    });
}
