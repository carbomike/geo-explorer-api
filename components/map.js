 'use strict';

import Core from '../tools/core.js';
import Dom from '../tools/dom.js';
import Net from '../tools/net.js';
import Requests from '../tools/requests.js';
import Evented from './evented.js';

export default class Map extends Evented { 

	/**
	 * @description get the popup and view content from the feature's attributes
	 * {@link https://developers.arcgis.com/javascript/latest/api-reference/esri-widgets-Popup.html|ArcGIS API for JavaScript}
	 */
	get popup() { return this._view.popup; }

	/**
	 * @description get the view
	 * {@link https://developers.arcgis.com/javascript/latest/api-reference/esri-views-View.html#ui|ArcGIS API for JavaScript}
	 */
	get view() { return this._view; }

	constructor(container) {
		super();
		
		this._layers = {};
		this._behaviors = {};
		
		this._map = new ESRI.Map({ basemap: "streets" });
		
		this._view = new ESRI.views.MapView({
			animation : false,
			center: [-100, 63], 
			container: container, 
			map: this._map,  
			zoom: 4 
		});
		
		this._view.popup.collapseEnabled = false;

		this._view.on("click", this.OnMapView_Click.bind(this));
		
		var fullscreen = new ESRI.widgets.Fullscreen({ 
			view: this._view
		});

		this._view.ui.add(fullscreen, "top-left");
	}
	
	/**
	 * @description
	 * Add behavior to map (rectangle select, point identify)
	 * @param {*} id - item ID
	 * @param {*} behavior - The behavior to add
	 * @returns - The behavior
	 */
	AddBehavior(id, behavior) {
		this._behaviors[id] = behavior;
		
		return behavior;
	}
	
	/**
	 * @description
	 * Get the behavior in a map
	 * @param {*} id - item ID
	 * @returns - The behavior
	 */
	Behavior(id) {
		return this._behaviors[id] || null;
	}
	
	/**
	 * @description
	 * Place components (elements) in a suitable position on the UI
	 * @param {*} elements - element to be added 
	 * @param {*} position - position for the element to be added
	 * @todo
	 * Test for spread operator in Rollup
	 */
	Place(elements, position) {
		elements.forEach(e => this._view.ui.add(e, position));
	}
	
	/**
	 * @description
	 * Graphics are displayed in a GraphicsLayer and can contain more
	 * than one vector geometry (point, line, polygon). 
	 * @param {*} id - item ID
	 */
	AddGraphicsLayer(id) {
		var layer = new ESRI.layers.GraphicsLayer();
		
		this._layers[id] = layer;
		
		this._map.add(layer);
	}

	/**
	 * @description
	 * Feature layers group similar vector geometry features. The appearance
	 * of a feature layer over a base map is more manageable than other web layers
	 * (MapImageLayer, GraphicsLayer). 
	 * @param {*} id - item ID
	 */
	AddFeatureLayer(id, url, labels, visibility){
		var layer = new ESRI.layers.FeatureLayer({
			url: url,
			fields:[{
				name: id,
				alias: labels
			}],
			visible: visibility
		});

		this._layers[id] = layer;

		this._map.add(layer);
	}
	
	/**
	 * @description
	 * Display data from server (map service) to the map based on request. 
	 * Much faster dynamically exporting image layers than exporting by features.
	 * @param {*} id - item ID
	 * @param {*} url - Map Server url for the layer
	 * @param {*} opacity - transparency between 0 to 1
	 * @param {*} dpi - dots per inch for dot density
	 * @param {*} format 
	 */
	AddMapImageLayer(id, url, opacity, dpi, format) {
		if (this._layers[id]) throw new Error("Layer already exists in map.");
		
		var layer = new ESRI.layers.MapImageLayer({
			url: url,
			imageFormat : format || 'png8',
			opacity : opacity || 1,
			dpi : dpi || 96,
			sublayers: []
		});
		
		this._layers[id] = layer;
		
		this._map.add(layer);
	}
	
	/**
	 * @description
	 * Clean a layer of all it's sublayers
	 * @param {*} id - item ID
	 */
	EmptyLayer(id) {
		this.Layer(id).sublayers.removeAll();
	}
	
	/**
	 * @description
	 * Map services contain sublayers. Add a sublayer to
	 * a layer.
	 * @param {*} id - item ID
	 * @param {*} sublayer - One of the several layers part of a group layer
	 */
	AddSubLayer(id, sublayer) {
		this.Layer(id).sublayers.add(sublayer);
	}
	
	/**
	 * @description
	 * Map services contain sublayers. Add sublayers to
	 * a layer.
	 * @param {*} id - item ID
	 * @param {*} sublayer - One of the several layers part of a group layer
	 */
	AddSubLayers(id, sublayers) {
		this.Layer(id).sublayers.addMany(sublayer);
	}
	
	/**
	 * @description
	 * Get the layer from layers
	 * @param {*} id - item ID
	 * @returns - A layer
	 */
	Layer(id) {
		return this._layers[id] || null;
	}
	
	/**
	 * @description
	 * Identify the selected feature in a layer
	 * @param {*} layer - reference to a dataset containing spatial properties
	 * @param {*} geometry - holds type (point, polygon, line), extent, 
	 * spatial reference, lat, long, etc. 
	 * @returns - Async operation outcome
	 */
	Identify(layer, geometry) {
		var d = Core.Defer();
		
		Requests.Identify(layer, geometry).then(result => {
			d.Resolve(result);			
		}, error => this.OnMapView_Error(error));
		
		return d.promise;
	}
	
	/**
	 * @description
	 * Occurs when you search for a place or zoom into a feature in
	 * the map. Takes the current view and moves it to the desired
	 * location.
	 * @param {*} target - Where to view
	 */
	GoTo(target) {
		this._view.goTo(target);
	}
	
	OnMapView_Click(ev) {		
		this.Emit("Click", ev);
	}
	
	OnMapView_Error(error) {		
		this.Emit("Error", { error:error });
	}
}