HTMLElement = typeof(HTMLElement) != 'undefiend' ? HTMLElement : Element;
HTMLElement.prototype.prependChild = function(element) {
    if (this.firstChild) {
        return this.insertBefore(element, this.firstChild);
    } else {
        return this.appendChild(element);
    }
};
HTMLDocument.prototype.getHeight = function() {
	return document.body.clientHeight;
}
HTMLElement.prototype.getHeight = function() {
	return this.clientHeight;
}
HTMLDocument.prototype.getScrollTop = HTMLElement.prototype.getScrollTop = function() {
	var doc = document.documentElement;
	return (window.pageYOffset || doc.scrollTop)  - (doc.clientTop || 0);
}
HTMLDocument.prototype.getScrollLeft = HTMLElement.prototype.getScrollLeft = function() {
	var doc = document.documentElement;
	return (window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0);
}

HTMLElement.prototype.scrollParent = function() {
	var regex = /(auto|scroll)/;
	var parents = function (node, ps) {
		if (node.parentNode === null) { return ps; }
			return parents(node.parentNode, ps.concat([node]));
	};
	var style = function (node, prop) {
		return getComputedStyle(node, null).getPropertyValue(prop);
	};
	var overflow = function (node) {
		return style(node, "overflow") + style(node, "overflow-y") + style(node, "overflow-x");
	};
	var scroll = function (node) {
		return regex.test(overflow(node));
	};
	var scrollParent = function () {
		if (!(this instanceof HTMLElement)) {
			return ;
		}
		var ps = parents(this.parentNode, []);
		for (var i = 0; i < ps.length; i += 1) {
			if (scroll(ps[i])) {
				return ps[i];
			}
		}
		return document;
	};
	return scrollParent;
}();

var ListAdapter = function(containerEl, adapter) {
	if(typeof(containerEl) == "string") {
		containerEl = document.querySelector(containerEl);
	}
	this.containerEl = containerEl;
	this.itemCreateHandler = (adapter && adapter.onItemCreate) || function(){};
	this.itemLoadHandler = (adapter && adapter.onItemLoad) || function(){};

	this.itemsCount = 0;
	this.offscreenItems = 1;

	this.itemsPool = new Array();

	if(!containerEl || containerEl === null)
		throw new "List container not specified.";

	if(containerEl.childElementCount == 0)
		throw new "List container must have at least 1 element as a template.";


	var tmpDisplay = containerEl.style.display;
	containerEl.style.display = 'block';
	
	var item = containerEl.children[0];
	this.itemHeight = item.offsetHeight;
	if(this.itemHeight == 0)
		this.itemHeight = parseInt(item.style.height);

	this.offsetTop = containerEl.offsetTop;
	containerEl.style.display = tmpDisplay;


	item.style.position = "absolute";
	this.itemHtml = item.outerHTML;

	var item = this.createBaseViewHolder(item);
	this.itemCreateHandler(item);
	this.recycleItem(item.el);

	this.scrollParentEl = this.containerEl.scrollParent();
	this.scrollParentEl.addEventListener("scroll", this.postUpdate.bind(this), false);
	window.addEventListener("resize", this.postUpdate.bind(this));
};

ListAdapter.prototype.destroy = function() {
	this.scrollParentEl.removeEventListener("scroll", this.postUpdate.bind(this));
	window.removeEventListener("resize", this.postUpdate.bind(this));
	this.itemsPool = undefined;
	this.items = undefined;
	this.itemHtml = undefined;
	this.containerEl = undefined;
}


ListAdapter.prototype.postUpdate = function() {
	if(!this.scrollLock && this.containerEl.offsetParent != null) {
    	this.scrollLock = true;
		window.requestAnimationFrame(this.updateItems.bind(this));
	}
}

ListAdapter.prototype.setItems = function(items, offset) {
	if(offset == undefined) {
		this.itemsCount = items.length;
		this.items = items;	
	} else {
		if((offset + items.length) < this.itemsCount) {
			this.itemsCount = offset + items.length;
		}
		for (var i = 0; i < items.length; i++) {
			this.items[i + offset] = items[i];
		}
	}
	this.containerEl.style.height = this.itemsCount * this.itemHeight;

	this.updateItems();
	this.invalidate();
};

ListAdapter.prototype.setItemsCount = function(num) {
	this.itemsCount = num;
	this.items = new Array(num);

	this.containerEl.style.height = this.itemsCount * this.itemHeight;
	
	this.updateItems();
	this.invalidate();
}

ListAdapter.prototype.createBaseViewHolder = function(el) {
	var vh = { el: el, q: el.querySelector.bind(el) };
	el.viewHolder = vh;
	return vh;
}
ListAdapter.prototype.getItemEl = function(index) {
	var item = this.itemsPool.pop();
	if(item == undefined) {
		var div = document.createElement('div');
		div.innerHTML = this.itemHtml;
		item = this.createBaseViewHolder(div.firstChild);
		this.itemCreateHandler(item);
	}

	this.itemLoadHandler(item, index, this.items[index]);

	return item.el;
};

ListAdapter.prototype.recycleItem = function(el) {
	this.itemsPool.push(el.viewHolder);
	el.remove();
};

ListAdapter.prototype.updateItems = function() {
	this.scrollLock = true;
	var list = this.containerEl;
	var scroll = this.scrollParentEl;
	var itemHeight = this.itemHeight;
	var itemHtml = this.itemHtml;

	this.offsetTop = list.offsetTop;
	
	var scrollOffset = scroll.getScrollTop();
	var topOffscreen = scrollOffset - (this.offscreenItems  * this.itemHeight);
	var bottomOffscreen = scroll.getHeight() + (this.offscreenItems * this.itemHeight) + scrollOffset;

	while(this.firstEl) {
		var first = this.firstEl;
		if((first.offsetTop + first.offsetHeight) < topOffscreen) {
			this.recycleItem(first);
			if(list.childElementCount > 0) {
				this.firstEl = list.children[0];
			} else {
				this.firstEl = this.lastEl = false;
			}
		} else {
			break;
		}
	}
	while(this.lastEl) {
		var last = this.lastEl;
		if(last.offsetTop > bottomOffscreen) {
			this.recycleItem(last);
			if(list.childElementCount > 0) {
				this.lastEl = list.children[list.childElementCount - 1];
			} else {
				this.firstEl = this.lastEl = false;
			}
		} else {
			break;
		}
	}

	while(this.firstEl && this.firstEl.offsetTop > topOffscreen) {
		var index = this.firstEl.position - 1;
		if(index >= 0) {
			var el = this.getItemEl(index);
			el.position = index;
			el.style.top = this.offsetTop + index * itemHeight;
			list.prependChild(el);
			this.firstEl = el;
			if(!this.lastEl) this.lastEl = this.firstEl;
		} else {
			break;
		}
	}

	while(!this.lastEl || (this.lastEl.offsetTop + this.lastEl.offsetHeight) < bottomOffscreen) {
		var index = 0;
		if(this.lastEl) {
			index = this.lastEl.position + 1;	
		} else if(this.itemsCount > 0) {
			index = Math.max(Math.floor(scrollOffset / itemHeight), 0);
		} else {
			break;
		}
		if(index >= 0 && index < this.itemsCount) {
			var el = this.getItemEl(index);
			el.position = index;
			el.style.top = this.offsetTop + index * itemHeight;
			list.appendChild(el);
			this.lastEl = el;
			if(!this.firstEl) this.firstEl = this.lastEl;
		} else {
			break;
		}
	}
	this.scrollLock = false;
}

ListAdapter.prototype.invalidate = function() {
	var list = this.containerEl;
	var itemHandler = this.itemHandler;

	for (var i = 0; i < list.childElementCount; i++) {
		var item = list.children[i];
		var index = item.position;
		item.style.top = this.offsetTop + index * this.itemHeight;
		this.itemLoadHandler(item.viewHolder, index, this.items[index]);
	};
}

