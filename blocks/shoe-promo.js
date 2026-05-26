defineModule('theme-shoe-promo', () => {
  class ShoePromo extends BaseElement {
    #grouped;
    #selections;
    constructor() {
      super();
      try {
        this.#init();
      } catch (e) {
        this.#showError('Init error: ' + e.message);
      }
    }

    #init() {
      var variantData = this.#getJSON('variant-data');
      var optionData = this.#getJSON('option-data');

      if (!variantData || !variantData.length) {
        this.#showError('No variant data found. Please set up product variants with a "Pair" option.');
        return;
      }
      if (!optionData || !optionData.length) {
        this.#showError('No option data found.');
        return;
      }

      var pairIndex = this.#findPairOptionIndex(optionData);
      if (pairIndex < 0) {
        this.#showError('No option with "pair" in its name found. Options: ' + optionData.map(function(o) { return o.name; }).join(', '));
        return;
      }

      var grouped = this.#groupByPair(variantData, pairIndex);
      if (!grouped.size) {
        this.#showError('No variants with pair values found.');
        return;
      }

      this.#grouped = grouped;
      this.#selections = {};
      this.#renderTabs(grouped);
      var firstEntry = Array.from(grouped.entries())[0];
      this.#selections['Promo Tier'] = firstEntry[0];
      this.#renderItems(firstEntry[1]);
      this.#syncProperties();
      this.#hidePairFromVariantPicker(pairIndex);
    }

    #showError(msg) {
      this.innerHTML = '<div style="padding:12px;color:#d32f2f;font-size:13px;background:#ffebee;border-radius:4px;">[shoe-promo] ' + msg + '</div>';
    }

    #getJSON(name) {
      var el = this.querySelector('script[name="' + name + '"]');
      if (!el) return null;
      try { return JSON.parse(el.textContent.trim()); } catch (_) { return null; }
    }

    #findPairOptionIndex(options) {
      return options.findIndex(function (opt) {
        return opt.name && opt.name.toLowerCase().indexOf('pair') >= 0;
      });
    }

    #groupByPair(variants, pairIndex) {
      var map = new Map();
      for (var i = 0; i < variants.length; i++) {
        var v = variants[i];
        var key = v.options[pairIndex];
        if (!map.has(key)) {
          map.set(key, v);
        }
      }
      return map;
    }

    #formatPrice(price) {
      var n = Number(price);
      if (!n && n !== 0) return '';
      return 'S$' + (n / 100).toFixed(2);
    }

    #renderTabs(grouped) {
      var self = this;
      var entries = Array.from(grouped.entries());
      var container = document.createElement('div');
      container.className = 'shoe-promo__tabs';

      entries.forEach(function (entry, i) {
        var label = entry[0];
        var variant = entry[1];
        var tab = document.createElement('div');
        tab.className = 'shoe-promo__tab';
        if (i === 0) {
          tab.classList.add('shoe-promo__tab--selected');
        }
        tab.dataset.pairValue = label;

        var price = self.#formatPrice(variant.price);
        var comparePrice = self.#formatPrice(variant.compare_at_price);
        var showCompare = comparePrice && Number(variant.compare_at_price) > Number(variant.price);

        tab.innerHTML =
          '<div class="shoe-promo__tab-label">' + self.#esc(label) + '</div>' +
          '<div class="shoe-promo__tab-pricing">' +
            '<span class="shoe-promo__tab-current">' + price + '</span>' +
            (showCompare ? '<span class="shoe-promo__tab-original">' + comparePrice + '</span>' : '') +
          '</div>';

        if (variant.is_recommended) {
          var badge = document.createElement('div');
          badge.className = 'shoe-promo__badge';
          badge.textContent = 'Most recommended';
          tab.appendChild(badge);
        }

        tab.addEventListener('click', function () {
          self.#switchTab(tab, entries, grouped);
        });
        container.appendChild(tab);
      });

      this.appendChild(container);
    }

    #switchTab(selectedTab, entries, grouped) {
      var self = this;
      var pairValue = selectedTab.dataset.pairValue;
      this.querySelectorAll('.shoe-promo__tab').forEach(function (t) {
        t.classList.toggle('shoe-promo__tab--selected', t === selectedTab);
      });

      this.#selections['Promo Tier'] = pairValue;
      this.#syncProperties();

      var variant = grouped.get(pairValue);
      if (variant) {
        self.#renderItems(variant);
      }
    }

    #renderItems(variant) {
      var existing = this.querySelector('.shoe-promo__items');
      if (existing) existing.remove();

      var container = document.createElement('div');
      container.className = 'shoe-promo__items';

      var itemsJson = null;
      try {
        var raw = variant.items_value || '';
        itemsJson = raw ? this.#parseGoValue(raw) : null;
      } catch (_) {}

      if (!itemsJson || typeof itemsJson !== 'object') {
        container.innerHTML = '<div class="shoe-promo__item-title">No items metafield found on this variant. Raw value: ' + this.#esc(String(raw).substring(0, 100)) + '</div>';
        this.appendChild(container);
        return;
      }

      var idx = 0;
      var self = this;
      for (var title in itemsJson) {
        if (!itemsJson.hasOwnProperty(title)) continue;
        idx++;
        var data = itemsJson[title];
        var itemSection = document.createElement('div');
        itemSection.className = 'shoe-promo__item';
        itemSection.dataset.item = String(idx);

        var colors = Array.isArray(data.colors) ? data.colors : (Array.isArray(data.color) ? data.color : []);
        var sizes = Array.isArray(data.sizes) ? data.sizes : (Array.isArray(data.size) ? data.size : []);
        var images = Array.isArray(data.images) ? data.images : (Array.isArray(data.image) ? data.image : []);

        itemSection.innerHTML =
          '<h3 class="shoe-promo__item-title">' +
            '<span class="shoe-promo__item-number">' + idx + '</span> ' + self.#esc(title) +
          '</h3>' +
          '<div class="shoe-promo__meta-label">' +
            'Color: <span class="shoe-promo__color-text" data-item="' + idx + '">' + (colors[0] || '') + '</span>' +
          '</div>' +
          '<div class="shoe-promo__color-grid"></div>' +
          '<div class="shoe-promo__meta-label">' +
            'Size: <span class="shoe-promo__size-text" data-item="' + idx + '">' + (sizes[0] || '') + '</span>' +
          '</div>' +
          '<div class="shoe-promo__size-grid"></div>';

        container.appendChild(itemSection);

        this.#renderColorGrid(itemSection, colors, images, idx);
        this.#renderSizeGrid(itemSection, sizes, idx);

        if (colors[0]) this.#selections['Item ' + idx + ' - Color'] = colors[0];
        if (sizes[0]) this.#selections['Item ' + idx + ' - Size'] = sizes[0];
      }

      this.appendChild(container);
    }

    #renderColorGrid(section, colors, images, itemNum) {
      var grid = section.querySelector('.shoe-promo__color-grid');
      if (!grid || !colors.length) return;
      var self = this;

      colors.forEach(function (color, i) {
        var opt = document.createElement('div');
        opt.className = 'shoe-promo__color-option';
        if (i === 0) opt.classList.add('shoe-promo__color-option--active');
        opt.dataset.color = color;
        opt.dataset.item = String(itemNum);

        var imgUrl = images[i] || '';
        opt.innerHTML =
          (imgUrl ? '<img src="' + self.#esc(imgUrl) + '" alt="' + self.#esc(color) + '">' : '') +
          '<div class="shoe-promo__color-name">' + self.#esc(color) + '</div>';

        opt.addEventListener('click', function () {
          self.#selectColor(itemNum, color, opt);
        });
        grid.appendChild(opt);
      });
    }

    #renderSizeGrid(section, sizes, itemNum) {
      var grid = section.querySelector('.shoe-promo__size-grid');
      if (!grid || !sizes.length) return;
      var self = this;

      sizes.forEach(function (size, i) {
        var opt = document.createElement('div');
        opt.className = 'shoe-promo__size-option';
        if (i === 0) opt.classList.add('shoe-promo__size-option--active');
        opt.dataset.size = size;
        opt.dataset.item = String(itemNum);
        opt.textContent = size;

        opt.addEventListener('click', function () {
          self.#selectSize(itemNum, size, opt);
        });
        grid.appendChild(opt);
      });
    }

    #selectColor(itemNum, colorName, element) {
      var textEl = this.querySelector('.shoe-promo__color-text[data-item="' + itemNum + '"]');
      if (textEl) textEl.textContent = colorName;

      var parent = element.parentElement;
      parent.querySelectorAll('.shoe-promo__color-option').forEach(function (o) {
        o.classList.remove('shoe-promo__color-option--active');
      });
      element.classList.add('shoe-promo__color-option--active');

      this.#selections['Item ' + itemNum + ' - Color'] = colorName;
      this.#syncProperties();
    }

    #selectSize(itemNum, sizeValue, element) {
      var textEl = this.querySelector('.shoe-promo__size-text[data-item="' + itemNum + '"]');
      if (textEl) textEl.textContent = sizeValue;

      var parent = element.parentElement;
      parent.querySelectorAll('.shoe-promo__size-option').forEach(function (o) {
        o.classList.remove('shoe-promo__size-option--active');
      });
      element.classList.add('shoe-promo__size-option--active');

      this.#selections['Item ' + itemNum + ' - Size'] = sizeValue;
      this.#syncProperties();
    }

    #hidePairFromVariantPicker(pairIndex) {
      var container = this.parentElement;
      if (!container) return;
      var picker = container.querySelector('theme-variant-radio-picker, theme-variant-select-picker');
      if (!picker) return;
      var fieldsets = picker.querySelectorAll('fieldset.variant-picker__group');
      if (fieldsets.length <= 1) {
        picker.style.display = 'none';
      } else {
        var target = picker.querySelector('fieldset[data-index="' + pairIndex + '"]');
        if (target) target.style.display = 'none';
      }
    }

    #syncProperties() {
      var form = this.closest('form') || document.querySelector('theme-product-form form');
      if (!form) return;

      var prefix = 'properties[Shoe Promo - ';

      for (var key in this.#selections) {
        if (!this.#selections.hasOwnProperty(key)) continue;
        var name = prefix + key + ']';
        var escaped = name.replace(/"/g, '&quot;').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
        var input = form.querySelector('input[name="' + escaped + '"]');
        if (!input) {
          input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          form.appendChild(input);
        }
        input.value = this.#selections[key];
      }
    }

    #parseGoValue(str) {
      str = str.trim();
      if (!str) return null;
      if (str.indexOf('map[') === 0) {
        return this.#parseGoMap(str);
      }
      if (str.indexOf('[') === 0) {
        return this.#parseGoSlice(str);
      }
      return str;
    }

    #parseGoMap(str) {
      var inner = str.slice(4, -1).trim();
      var result = {};
      var pairs = this.#splitTopLevel(inner, ' ');
      for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i];
        var colonAt = pair.indexOf(':');
        if (colonAt < 0) continue;
        var key = pair.slice(0, colonAt).trim();
        var val = pair.slice(colonAt + 1).trim();
        result[key] = this.#parseGoValue(val);
      }
      return result;
    }

    #parseGoSlice(str) {
      var inner = str.slice(1, -1).trim();
      if (!inner) return [];
      var parts = this.#splitTopLevel(inner, ' ');
      return parts.map(function (p) { return p.trim(); });
    }

    #splitTopLevel(str, sep) {
      var parts = [];
      var depth = 0;
      var current = '';
      for (var i = 0; i < str.length; i++) {
        var ch = str[i];
        if (ch === '[') depth++;
        if (ch === ']') depth--;
        if (ch === sep && depth === 0) {
          if (current) parts.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
      if (current) parts.push(current);
      return parts;
    }

    #esc(str) {
      return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }
  }

  customElements.define('theme-shoe-promo', ShoePromo);
});
