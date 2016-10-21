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
	return this.scrollTop || ((window.pageYOffset || doc.scrollTop)  - (doc.clientTop || 0));
}
HTMLDocument.prototype.getScrollLeft = HTMLElement.prototype.getScrollLeft = function() {
	var doc = document.documentElement;
	return (window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0);
}
HTMLElement.prototype.addClass = function(className) {
	this.className += ' ' + className;
}
HTMLElement.prototype.removeClass = function(className) {
	this.className = this.className.replace(className, '');
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

var GroupSelector = function(listEl) {
	this.target = listEl;
};
GroupSelector.prototype.attr = function(key, val) {
	this.target.forEach(function(el) {
		el[key] = val;
	});
};
GroupSelector.prototype.css = function(key, val) {
	this.target.forEach(function(el) {
		el.style[key] = val;
	});
};
GroupSelector.prototype.className = function(className) {
	this.target.forEach(function(el) {
		el.className = className;
	});
};

var ListAdapter = function(containerEl, adapter) {
	if(typeof(containerEl) == "string") {
		containerEl = document.querySelector(containerEl);
	}
	this.containerEl = containerEl;
	if(!containerEl || containerEl === null)
		throw new "List container not specified.";

	//Copy constructor
	if(adapter instanceof ListAdapter) {
		this.itemCreateHandler = adapter.itemCreateHandler;
		this.itemLoadHandler = adapter.itemLoadHandler;
		this.itemTypeResolver = adapter.itemTypeResolver;
		this.itemsCount = 0;
		this.offscreenItems = adapter.offscreenItems;
		//Shared items pool
		this.itemsPool = adapter.itemsPool;
		this.itemHeight = adapter.itemHeight;
		this.itemsByType = adapter.itemsByType;
		this.itemsY = [];
		this.isMultiType = adapter.isMultiType;

		var tmpDisplay = containerEl.style.display;
		containerEl.style.display = 'block';
		this.offsetTop = containerEl.offsetTop;
		containerEl.style.display = tmpDisplay;

		this.itemHtml = adapter.itemHtml;
		
		this.scrollParentEl = this.containerEl.scrollParent();
		this.scrollParentEl.addEventListener("scroll", this.postUpdate.bind(this), false);
		window.addEventListener("resize", this.postUpdateAndInvalidate.bind(this));
	} else {	
		this.itemCreateHandler = (adapter && adapter.onItemCreate) || function(){};
		this.itemLoadHandler = (adapter && adapter.onItemLoad) || function(){};
		this.itemTypeResolver = (adapter && adapter.getItemType) || function(){ return 0; };

		this.itemsCount = 0;
		this.offscreenItems = 3;

		if(containerEl.childElementCount == 0)
			throw new "List container must have at least 1 element as a template.";

		this.itemsPool = {};
		this.itemsByType = {};
		this.itemsY = [];
		this.isMultiType = false;

		var tmpDisplay = containerEl.style.display;
		containerEl.style.display = 'block';
		
		this.itemHeight = 0;
		while (containerEl.childElementCount > 0) {
			var item = containerEl.children[0];
			item.remove();
			document.body.appendChild(item);

			var itemHeight = item.offsetHeight;
			if(itemHeight == 0) {
				itemHeight = parseInt(item.style.height);
			}

			item.style.position = "absolute";

			var itemType = (item.attributes['data-item-type'] && item.attributes['data-item-type'].value) || 0;
			this.itemsByType[itemType] = {
				height: itemHeight,
				html: item.outerHTML
			};
			this.itemsPool[itemType] = new Array();

			if(itemType != 0)
				this.isMultiType = true;

			item.remove();
			this.itemHeight = Math.max(this.itemHeight, itemHeight);
		};
		
		this.offsetTop = containerEl.offsetTop;
		containerEl.style.display = tmpDisplay;

		this.scrollParentEl = this.containerEl.scrollParent();
		this.scrollParentEl.addEventListener("scroll", this.postUpdate.bind(this), false);
		window.addEventListener("resize", this.postUpdateAndInvalidate.bind(this));
	}
};

ListAdapter.prototype.destroy = function() {
	this.scrollParentEl.removeEventListener("scroll", this.postUpdate.bind(this));
	window.removeEventListener("resize", this.postUpdateAndInvalidate.bind(this));
	this.itemsPool = undefined;
	this.items = undefined;
	this.itemHtml = undefined;
	this.containerEl = undefined;
};

ListAdapter.prototype.updateItemSize = function(itemSize) {
	this.itemHeight = itemSize;
	while(this.containerEl.childElementCount > 0) {
		this.recycleItem(this.containerEl.children[0]);
	}
	this.containerEl.style.height = this.itemsCount * itemSize;
	this.firstEl = this.lastEl = undefined;
	this.postUpdateAndInvalidate();
}

ListAdapter.prototype.postUpdate = function() {
	if(!this.scrollLock && this.containerEl.offsetParent != null) {
    	this.scrollLock = true;
		window.requestAnimationFrame(this.updateItems.bind(this));
	}
};
ListAdapter.prototype.postUpdateAndInvalidate = function() {
	if(!this.scrollLock && this.containerEl.offsetParent != null) {
    	this.scrollLock = true;

    	if(this.firstEl != undefined) {
	    	var itemHeight = this.firstEl.offsetHeight;
	    	if(itemHeight == 0) {
	    		itemHeight = this.firstEl.clientHeight;
	    	}
	    	if(itemHeight == 0) {
	    		itemHeight = parseInt(this.firstEl.style.height);
	    	}
	    	if(itemHeight > 0 && itemHeight != this.itemHeight) {
	    		this.updateItemSize(itemHeight);
	    	}
	    }
		window.requestAnimationFrame(this.updateAndInvalidate.bind(this));
	}
};

ListAdapter.prototype.updateAndInvalidate = function() {
	this.updateItems();
	this.invalidate();
};

ListAdapter.prototype.inAnimation = function() {
	var list = this.containerEl;
	var diff = this.offsetTop - list.offsetTop;
	
	if(this._inAnimationStart == undefined)
		this._inAnimationStart = new Date().getTime();

	if(diff != 0) {
		window.requestAnimationFrame(function() {
			this.offsetTop = list.offsetTop;
			for (var i = 0; i < list.childElementCount; i++) {
				var item = list.children[i];
				item.style.top = this.offsetTop + item.position * this.itemHeight;
			};
			setTimeout(this.inAnimation.bind(this), 16.5);
		}.bind(this));
	} else if((new Date().getTime() - this._inAnimationStart) < 200) {
		setTimeout(this.inAnimation.bind(this), 20);
	} else {
		this._inAnimationStart = undefined;
	}
}

ListAdapter.prototype.setItems = function(items, offset) {
	if(offset == undefined) {
		this.itemsCount = items.length;
		this.items = items;
		this.itemsY = new Array();

		if(this.isMultiType) {
			var height = 0;
			for (var i = 0; i < items.length; i++) {
				var type = this.itemTypeResolver(i, items[i]);
				height += this.itemsByType[type].height;
			};
			this.containerEl.style.height = height;
		} else {
			this.containerEl.style.height = this.itemsByType[0].height * items.length;
		}
	} else {
		if((offset + items.length) > this.itemsCount) {
			this.itemsCount = offset + items.length;
		}
		var addedHeight = 0;
		for (var i = 0; i < items.length; i++) {
			this.items[i + offset] = items[i];
			var type = this.itemTypeResolver(i + offset, items[i]);
			addedHeight += this.itemHeight - this.itemsByType[type].height;
		}
		this.containerEl.style.height -= addedHeight;
	}
	
	window.requestAnimationFrame(this.updateItems.bind(this));
	window.requestAnimationFrame(this.invalidate.bind(this));

};

ListAdapter.prototype.setItemsCount = function(num) {
	this.itemsCount = num;
	this.items = new Array(num);

	this.containerEl.style.height = this.itemsCount * this.itemHeight;
	
	window.requestAnimationFrame(this.updateItems.bind(this));
	window.requestAnimationFrame(this.invalidate.bind(this));
}
ListAdapter.prototype._queryAll = function(el, query) {
	return new GroupSelector(el.querySelectorAll(query));
}
ListAdapter.prototype.createViewHolder = function(el, itemType) {
	var vh = { el: el, itemType: itemType, q: el.querySelector.bind(el), all: this._queryAll.bind(this, el) };
	el.viewHolder = vh;
	return vh;
}
ListAdapter.prototype.getItemEl = function(index) {
	var data = this.items[index];
	var type = this.itemTypeResolver(index, data);
	var item = this.itemsPool[type].pop();
	if(item == undefined) {
		var div = document.createElement('div');
		div.innerHTML = this.itemsByType[type].html;
		item = this.createViewHolder(div.firstChild, type);
		this.itemCreateHandler(item, type);
	}

	this.itemLoadHandler(item, index, this.items[index], type);

	return item.el;
};

ListAdapter.prototype.recycleItem = function(el) {
	var vh = el.viewHolder;
	this.itemsPool[vh.itemType].push(vh)
	el.remove();
};

ListAdapter.prototype.getPositionForItem = function(index) {
	if(this.itemsY[index] != undefined) {
		return this.itemsY[index];
	} if(!this.isMultiType) {
		return this.itemsY[index] = index * this.itemHeight;
	} else if(index == 0) {
		return this.itemsY[index] = 0;
	} else {
		var type = this.itemTypeResolver(index-1, this.items[index-1]);
		return this.itemsY[index] = (this.getPositionForItem(index-1) + this.itemsByType[type].height);
	}
}

//Not optimal. Divide and conquer should be used.
ListAdapter.prototype.getItemForPosition = function(y) {
	for (var i = 0; i < this.items.length; i++) {
		var pos = this.getPositionForItem(i);
		if(pos >= y)
			return i;
	};
	return -1;
}

ListAdapter.prototype.updateItems = function() {
	this.scrollLock = true;
	var list = this.containerEl;
	var scroll = this.scrollParentEl;
	var itemsByType = this.itemsByType;
	var itemsPool = this.itemsPool;

	this.offsetTop = list.offsetTop;
	
	var scrollOffset = scroll.getScrollTop();
	var topOffscreen = scrollOffset - (this.offscreenItems * this.itemHeight);
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

	if(this.firstEl && this.firstEl.offsetTop > topOffscreen) {
		var index = this.firstEl.position - 1;
		if(index >= 0) {
			var el = this.getItemEl(index);
			el.position = index;
			el.style.top = this.offsetTop + this.getPositionForItem(index);
			list.prependChild(el);
			this.firstEl = el;
			if(!this.lastEl) this.lastEl = this.firstEl;
			window.requestAnimationFrame(this.updateItems.bind(this));
		}
	}

	if(!this.lastEl || (this.lastEl.offsetTop + this.lastEl.offsetHeight) < bottomOffscreen) {
		var index = -1;
		if(this.lastEl) {
			index = this.lastEl.position + 1;
		} else if(this.itemsCount > 0) {
			index = this.getItemForPosition(scrollOffset);
		}
		if(index >= 0 && index < this.itemsCount) {
			var el = this.getItemEl(index);
			el.position = index;
			el.style.top = this.offsetTop + this.getPositionForItem(index);
			list.appendChild(el);
			this.lastEl = el;
			if(!this.firstEl) this.firstEl = this.lastEl;
			window.requestAnimationFrame(this.updateItems.bind(this));
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
		item.style.top = this.offsetTop + this.getPositionForItem(index);
		this.itemLoadHandler(item.viewHolder, index, this.items[index], item.viewHolder.itemType);
	};
}

