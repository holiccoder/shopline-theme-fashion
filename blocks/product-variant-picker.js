defineModule('theme-product-variant-picker', () => {
    class VariantPicker extends BaseElement {
        variants;
        constructor() {
            super();
            this.variants = this.#getVariantData();
        }
        get options() {
            return [];
        }
        set options(options) {
        }
        get currentVariant() {
            const { options } = this;
            return this.getOptionRelatedVariant(options);
        }
        getOptionRelatedVariant(options) {
            return this.variants.find((variant) => variant.options.every((option, index) => option === options[index]));
        }
        #getVariantData() {
            const jsonStr = this.querySelector('script[name="variant-data"][type="application/json"]')?.textContent?.trim() || '{}';
            return JSON.parse(jsonStr);
        }
        getMetafieldsContainers() {
            return Array.from(this.querySelectorAll('[data-variant-metafields]'));
        }
        updateMetafields() {
            const containers = this.getMetafieldsContainers();
            if (containers.length === 0)
                return;
            const metafields = this.getVariantMetafields(this.currentVariant);
            const allItems = this.extractMetafieldItems(metafields);
            if (this.currentVariant?.items_value) {
                allItems.push({ label: 'items', value: this.currentVariant.items_value, isJson: true });
            }
            containers.forEach((container) => {
                const filter = container.dataset.variantMetafieldsFilter || '';
                const metafieldItems = this.filterMetafieldItems(allItems, filter);
                const content = metafieldItems.length
                    ? metafieldItems
                        .map((item) => {
                            if (item.isJson) {
                                return this.renderItemsJson(item.value);
                            }
                            return `<div class="variant-picker__metafield"><span class="variant-picker__metafield-key">${this.escapeHTML(item.label)}</span>: <span class="variant-picker__metafield-value">${this.escapeHTML(item.value)}</span></div>`;
                        })
                        .join('')
                    : '<div class="variant-picker__metafield">No variant metafields found for this variant.</div>';
                container.innerHTML = content;
                container.hidden = false;
            });
        }
        renderItemsJson(jsonStr) {
            try {
                const data = JSON.parse(jsonStr);
                if (!data || typeof data !== 'object')
                    return '';
                let html = '';
                for (const [itemName, itemData] of Object.entries(data)) {
                    if (!itemData || typeof itemData !== 'object')
                        continue;
                    const colors = Array.isArray(itemData.color) ? itemData.color.join(', ') : '';
                    const sizes = Array.isArray(itemData.sizes) ? itemData.sizes.join(', ') : '';
                    html += '<div class="variant-picker__metafield variant-picker__item-group">';
                    html += `<div class="variant-picker__item-name">${this.escapeHTML(itemName)}</div>`;
                    if (colors) {
                        html += `<div class="variant-picker__item-detail"><span class="variant-picker__metafield-key">Color</span>: <span class="variant-picker__metafield-value">${this.escapeHTML(colors)}</span></div>`;
                    }
                    if (sizes) {
                        html += `<div class="variant-picker__item-detail"><span class="variant-picker__metafield-key">Sizes</span>: <span class="variant-picker__metafield-value">${this.escapeHTML(sizes)}</span></div>`;
                    }
                    html += '</div>';
                }
                return html;
            }
            catch (_error) {
                return '';
            }
        }
        filterMetafieldItems(items, filter) {
            if (!filter)
                return items;
            const lowerFilter = filter.toLowerCase();
            return items.filter(({ label, value }) => label.toLowerCase().includes(lowerFilter) || value.toLowerCase().includes(lowerFilter));
        }
        getVariantMetafields(variant) {
            if (!variant || typeof variant !== 'object')
                return null;
            const candidates = [
                variant.metafields,
                variant.meta_fields,
                variant.custom_fields,
                variant.variant?.metafields,
                variant.variant?.meta_fields,
                variant.variant?.custom_fields,
                variant.variant,
            ];
            return candidates.find((item) => item && typeof item === 'object') || null;
        }
        extractMetafieldItems(metafields) {
            if (!metafields || typeof metafields !== 'object')
                return [];
            if (Array.isArray(metafields)) {
                return metafields
                    .map((item) => {
                    if (!item || typeof item !== 'object')
                        return null;
                    const namespace = item.namespace || item.name_space || 'metafield';
                    const key = item.key || item.field || item.name;
                    const rawValue = 'value' in item ? item.value : item;
                    const value = this.formatMetafieldValue(rawValue);
                    if (!key || !value)
                        return null;
                    return {
                        label: `${namespace}.${key}`,
                        value,
                    };
                })
                    .filter(Boolean);
            }
            const items = [];
            Object.entries(metafields).forEach(([namespace, fields]) => {
                if (!fields || typeof fields !== 'object')
                    return;
                Object.entries(fields).forEach(([key, field]) => {
                    const rawValue = field && typeof field === 'object' && 'value' in field ? field.value : field;
                    const value = this.formatMetafieldValue(rawValue);
                    if (value) {
                        items.push({
                            label: `${namespace}.${key}`,
                            value,
                        });
                    }
                });
            });
            return items;
        }
        formatMetafieldValue(value) {
            if (value === null || value === undefined)
                return '';
            if (Array.isArray(value)) {
                const formattedArray = value.map((item) => this.formatMetafieldValue(item)).filter(Boolean);
                return formattedArray.join(', ');
            }
            if (typeof value === 'object') {
                if ('value' in value) {
                    return this.formatMetafieldValue(value.value);
                }
                try {
                    return JSON.stringify(value);
                }
                catch (_error) {
                    return '';
                }
            }
            return String(value);
        }
        escapeHTML(value) {
            return value
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#39;');
        }
    }
    class VariantRadioPicker extends VariantPicker {
        constructor() {
            super();
            this.#onOptionChange();
            this.addEventListener('change', this.#onOptionChange.bind(this));
        }
        get optionGroups() {
            return Array.from(this.querySelectorAll('fieldset') ?? []);
        }
        get options() {
            const options = [];
            this.optionGroups.forEach((group) => {
                const groupIndex = Number(group.dataset.index || 0);
                const selectedOption = group.querySelector('input[type="radio"]:checked')?.value;
                options[groupIndex] = selectedOption;
            });
            return options;
        }
        set options(options) {
            this.optionGroups.forEach((group) => {
                const groupIndex = Number(group.dataset.index || 0);
                const optionValue = options[groupIndex];
                Array.from(group.elements).forEach((element) => {
                    if (element instanceof HTMLInputElement && element.type === 'radio') {
                        element.checked = element.value === optionValue;
                    }
                });
            });
            this.#onOptionChange();
        }
        #onOptionChange() {
            this.#updateOptionStatus();
            this.updateMetafields();
        }
        #updateOptionStatus() {
            const { optionGroups, options } = this;
            const hasSelectedOptions = options.some((option) => option !== undefined);
            if (options.length !== optionGroups.length)
                return;
            optionGroups.forEach((group) => {
                const groupIndex = Number(group.dataset.index || 0);
                const optionElements = Array.from(group.elements);
                const targetOptions = [...options];
                optionElements.forEach((optionElement) => {
                    targetOptions[groupIndex] = optionElement.value;
                    const targetVariant = this.getOptionRelatedVariant(targetOptions);
                    const labelElement = optionElement.parentElement;
                    if (hasSelectedOptions) {
                        labelElement?.classList.toggle('disabled', !(targetVariant && targetVariant.available));
                    }
                    else {
                        labelElement?.classList.remove('disabled');
                    }
                });
            });
        }
    }
    class VariantSelectPicker extends VariantPicker {
        constructor() {
            super();
            this.#updateOptionStatus();
            this.addEventListener('change', this.#updateOptionStatus.bind(this));
        }
        get optionGroups() {
            return Array.from(this.querySelectorAll('select'));
        }
        get options() {
            return Array.from(this.querySelectorAll('select')).map((select) => select.value);
        }
        set options(options) {
            Array.from(this.querySelectorAll('select')).forEach((select, index) => {
                select.value = options[index] || '';
            });
            this.#updateOptionStatus();
        }
        get unavailableText() {
            return this.getAttribute('data-unavailable-text') || '';
        }
        get unavailableStyle() {
            return this.getAttribute('data-unavailable-style') || '';
        }
        #updateOptionStatus() {
            const { optionGroups, options, unavailableText, unavailableStyle } = this;
            const hasSelectedOptions = options.some((option) => option !== undefined);
            if (options.length !== optionGroups.length)
                return;
            optionGroups.forEach((group) => {
                const groupIndex = Number(group.dataset.index || 0);
                const optionElements = Array.from(group.options);
                const targetOptions = [...options];
                const themeSelect = group.closest('theme-select');
                optionElements.forEach((optionElement) => {
                    const { value } = optionElement;
                    targetOptions[groupIndex] = value;
                    const targetVariant = this.getOptionRelatedVariant(targetOptions);
                    const isUnavailable = hasSelectedOptions ? !(targetVariant && targetVariant.available) : false;
                    const templateOptionElement = optionElement.querySelector('template')?.content
                        ?.firstElementChild;
                    const mockOptionElement = themeSelect.querySelector(`.theme-select__option[value="${CSS.escape(optionElement.value)}"]`);
                    [optionElement, templateOptionElement, mockOptionElement].forEach((element) => {
                        if (element) {
                            if (unavailableStyle === 'text') {
                                const label = isUnavailable ? `${value} ${unavailableText}` : value;
                                const labelElement = element.querySelector('.variant-picker__label');
                                if (labelElement) {
                                    labelElement.textContent = label;
                                }
                            }
                            element.classList.toggle('disabled', isUnavailable);
                            const optionContentElement = element.querySelector('.variant-picker__select-option');
                            if (optionContentElement) {
                                optionContentElement.classList.toggle('disabled', isUnavailable);
                            }
                        }
                    });
                });
                const selectedOption = group.options[group.selectedIndex];
                group.classList.toggle('disabled', selectedOption.classList.contains('disabled'));
            });
            this.updateMetafields();
        }
    }
    customElements.define('theme-variant-radio-picker', VariantRadioPicker);
    customElements.define('theme-variant-select-picker', VariantSelectPicker);
});
