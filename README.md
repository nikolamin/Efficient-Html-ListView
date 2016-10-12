# Efficient-Html-ListView
Efficiency create view elements and manage dom to render only visible elements. View Holder pattern for populating the views.
Pool for reusing dom elements.
You can list millions of items without performance issues.

## Installation
<script src="src/listadapter.js"></script>

## Usage
Create your html with one div as container of the items, and one child inside it as view template (currently only one type of view is supported).
Note: Child view must support 'positon: absolute;' displaying.

In your script create an instance of ListAdapter class.
```
var myList = ListAdapter("#list", adapter);
```

First paramter is querySelector for the list container, it can also be dom element.
Second parameter is your adapter implemention to create an populate items.
The adapter should be an object with following functions as property:
onItemCreate (optional) : function(item)
	This callback is invoked each time new item is created, so its recomended here to make references to the elements you want to change later.
	Paramter 'item' is a view-holder, it have 'el' property which is a reference to the dom element, and 'q' property which is a shortcut-reference to the query selector of 'el', you can attach other properties (references to html elements of the view) to use them later in 'onItemLoad'.
	Example:
```
	onItemCreate: function(item) {
		item.title = item.q("h2");
		item.description = item.q("h3");
		item.image = item.q("img");
	}
```
onItemLoad : function(item, index, itemData)
	This callback is invoked each time item is placed to the document and will become visible, so here you should populate it with the information you want to show.
	Example: 
```
	onItemLoad: function(item, index, itemData) {
		item.title.innerText = itemData.title;
		item.description.innerText = itemData.description;
		item.image.src = "https://www.w3.org/html/logo/downloads/HTML5_Logo_512.png";
	}
```

Now give the data you want to render in the list:
```
	myList.setItems([
		{ title: "First Item", description: "First item description" },
		{ title: "Second Item", description: "Second item description" },
		{ title: "Thrid Item", description: "Thrid item description" },
		{ title: "4th Item", description: "4th item description" }
	]);
```

You can banchmark by telling only how many items you want to have
```
	myList.setItemsCount(1000000);
```
and populate them dynamically:
```
var myList = new ListAdapter("#list", {
	onItemCreate: function(item) {
		item.title = item.q("h2");
		item.description = item.q("h3");
		item.image = item.q("img");
	},
	onItemLoad: function(item, index, itemData) {
		item.title.innerText = "This is item " + (index+1);
		item.description.innerText = "This is description for item " + (index+1);
		item.image.src = "https://www.w3.org/html/logo/downloads/HTML5_Logo_512.png";
	}
});
```

## Demo
You can find demos in this repo.
Or you can try demo: [list adapter demo](https://cdn.rawgit.com/nikolamin/Efficient-Html-ListView/master/demo.html)
Or benchmark demo: [list adapter demo - with milion items](https://cdn.rawgit.com/nikolamin/Efficient-Html-ListView/master/demo-1m.html)

## Advanced
To avoid some flickerings when scrolling very fast, the ListAdapter loads extra views off-screen.
By default they are 3 from top and 3 from bottom, you can configure this by changing value of `myList.offscreenItems`
