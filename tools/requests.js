import Core from './core.js';

const URLS = {
	renderer : "https://www97.statcan.gc.ca/arcgis/rest/services/CHSP/stcdv_dyn/MapServer/dynamicLayer/generateRenderer",
	placename : "https://www97.statcan.gc.ca/arcgis/rest/services/CHSP/stcdv_lookup/MapServer/0",
	value : "https://www97.statcan.gc.ca/arcgis/rest/services/CHSP/stcdv_lookup/MapServer/1",
	geography : "https://www97.statcan.gc.ca/arcgis/rest/services/CHSP/stcdv_lookup/MapServer/2",
	indicator : "https://www97.statcan.gc.ca/arcgis/rest/services/CHSP/stcdv_lookup/MapServer/3",
	breaks : "https://www97.statcan.gc.ca/arcgis/rest/services/CHSP/stcdv_lookup/MapServer/4",
	filter : "https://www97.statcan.gc.ca/arcgis/rest/services/CHSP/stcdv_lookup/MapServer/8"
}

export default class Requests {
	
	static MakeItem(f, value, label, description, locale) {
		var item = {
				value : f.attributes[value],
				label : f.attributes[`${label}_${locale}`]
			} 
			
		if (description) item.description = f.attributes[`${description}_${locale}`]
		
		return item;
	}
	
	static MakeItems(features, value, label, description) {
		var locale = Core.locale.toUpperCase();
		
		return features.map(f => {
			return Requests.MakeItem(f, value, label, description, locale);
		});
	}
	
	static MakeMetadata(attr) {
		return {
			indicator : attr.IndicatorId,
			query : attr.PrimaryQuery,
			breaks : {
				n : attr.DefaultBreaks,
				algoId : attr.DefaultBreaksAlgorithmId,
				algo : null
			},
			colors : {
				start : attr.ColorFrom.split(","),
				end : attr.ColorTo.split(",")
			}
		}
	}
	
	static Query(layer, where, geometry, returnGeometry, outFields, distinct, orderBy) {
		var query = layer.createQuery();
		
		query.returnGeometry = !!returnGeometry;
		query.returnDistinctValues = !!distinct;
		
		if (outFields) query.outFields = outFields;
		if (where) query.where = where;
		if (geometry) query.geometry = geometry;
		if (orderBy) query.orderByFields = orderBy;
		
		return layer.queryFeatures(query);
	}
	
	static QueryGeometry(layer, geometry) {
		return Requests.Query(layer, null, geometry, true, "*", null, null);
	}
	
	static QueryUrl(url, where, geometry, returnGeometry, outFields, distinct, orderBy) {		
		var layer = ESRI.layers.FeatureLayer({ url:url });
		
		return Requests.Query(layer, where, geometry, returnGeometry, outFields, distinct, orderBy);
	}
	
	static QueryTable(url, where, returnGeometry) {		
		return Requests.QueryUrl(url, where, null, !!returnGeometry, "*", true, null);
	}
	
	static Indicator(id) {
		var d = Core.Defer();
		
		var where = (id == null) ? `ParentThemeId is ${id}` : `ParentThemeId = ${id}`;
		
		Requests.QueryTable(URLS.indicator, where).then(r => {
			var items = Requests.MakeItems(r.features, "IndicatorThemeId", "IndicatorTheme", "IndicatorThemeDescription");
			
			items = items.filter(i => i.value % 10000 != 9999);
						
			d.Resolve(items);
		}, error => { d.Reject(error) });
		
		return d.promise;
	}
	
	static Category(id) {
		var d = Core.Defer();
		
		var where = `IndicatorThemeId = ${id}`;
		
		Requests.QueryTable(URLS.filter, where).then(r => {
			var locale = Core.locale.toUpperCase();
			var dimensions = [];
			
			r.features.forEach(f => {
				var i = f.attributes["DisplayOrder"] - 1;

				if (!dimensions[i]) {
					dimensions[i] = {
						id : f.attributes["DimensionId"],
						type : f.attributes["DimensionType"],
						label : f.attributes[`Dimension_${locale}`],
						values : []
					};
				}
				
				var item = Requests.MakeItem(f, "DimensionValueId", "Display", null, locale);
				
				dimensions[i].values.push(item);
			});
			
			var filters = dimensions.filter(d => d.type == 'Filter');
			var values = dimensions.filter(d => d.type == 'Value');
			
			if (values.length > 1) d.Reject(new Error("More than one dimension of type Value received."));
			
			else d.Resolve({ filters:filters, value:values[0] });
		}, error => { d.Reject(error) });
		
		return d.promise;
	}

	static Metadata(indicators) {
		var d = Core.Defer();
		
		var where = `DimensionUniqueKey = '${indicators.join("-")}'`;
		
		Requests.QueryTable(URLS.value, where).then(r => {
			if (r.features.length > 1) d.Reject(new Error("Received more than one indicator Id."));
			
			var metadata = this.MakeMetadata(r.features[0].attributes);
			
			Requests.Break(metadata.breaks.algoId).then(breaks => {
				metadata.breaks.algo = breaks.BreakAlgorithm;
				
				d.Resolve(metadata);
			}, error => { d.Reject(error) });
		}, error => { d.Reject(error) });
		
		return d.promise;
	}
	
	static Geography(indicatorId) {
		var d = Core.Defer();
		
		var where = `IndicatorId = '${indicatorId}'`;
		
		Requests.QueryTable(URLS.geography, where).then(r => {
			var items = Requests.MakeItems(r.features, "GeographicLevelId", "LevelName", "LevelDescription");
			
			items = items.filter(item => item.value != "SSSS");
			
			d.Resolve(items);
		}, error => { d.Reject(error) });
		
		return d.promise;
	}
	
	static Break(id) {
		var d = Core.Defer();
		
		var where = `BreakAlgorithmId  = ${id}`;
		
		Requests.QueryTable(URLS.breaks, where).then(r => {
			if (r.features.length > 1) d.Reject(new Error("Received more than one break algorithm."));
			
			var data = r.features[0].attributes;
			
			d.Resolve(data);
		}, error => { d.Reject(error) });
		
		return d.promise;
	}
	
	static Renderer(context) {
		var meta = context.metadata;
		
		var d = Core.Defer();
		
		var layer = {
			"id": 7,
			"minScale": null,
			"name": "dyn_layer",
			"source": {
				"dataSource": {
					"type": "queryTable",
					"workspaceId": "stcdv_dyn_service",
					"query": meta.query,
					"oidFields": "GeographyReferenceId",
					"geometryType": "esriGeometryPolygon" 
				},
				"type":"dataLayer"
			}, 
			"definitionExpression":`GeographicLevelId = '${context.geography}' AND IndicatorId = ${meta.indicator}`
		}
		
		var classif = {
			"type": "classBreaksDef",
			"classificationField": "Value",
			"classificationMethod": meta.breaks.algo,
			"breakCount": meta.breaks.n,
			"colorRamp": {
				"type":"algorithmic",
				"fromColor": meta.colors.start,
				"toColor":meta.colors.end,
				"algorithm":"esriHSVAlgorithm"
			}
		};
		
		var data = {
			f : "json",
			layer: JSON.stringify(layer),
			where: `GeographicLevelId = '${context.geography}' AND IndicatorId = ${meta.indicator}`,
			classificationDef: JSON.stringify(classif)
		}
		
		var p = ESRI.request(URLS.renderer, {
			useProxy : true,
			method : "POST",
			responseType  : "json",
			query : (data)
		});
		
		p.then(renderer => {
			var sublayer = new ESRI.layers.support.Sublayer({ 
				id: 7, 
				visible: true,
				definitionExpression: data.where,
				renderer : ESRI.renderers.support.jsonUtils.fromJSON(renderer.data),
				source: {
					type: "data-layer",
					dataSource: {
						type: "query-table",
						workspaceId: "stcdv_dyn_service",
						query: meta.query,
						geometryType: "esriGeometryPolygon",
						oidFields: "GeographyReferenceId"
					}
				}
			});
			
			d.Resolve(sublayer);
		}, error => { d.Reject(new Error(error.message)) });
		
		return d.promise;
	}
	
	static Typeahead(value) { 
		var d = Core.Defer();
		
		var fields = ["GeographyReferenceId", "SearchDisplayName"];
		var where = `UPPER(SearchDisplayName) LIKE UPPER('${value}%') AND Lang = '${Core.locale.toUpperCase()}'`;
		
		Requests.QueryUrl(URLS.placename, where, null, false, fields, false, [`SearchDisplayName DESC`]).then(r => {
			var items = r.features.map(f => {
				return {
					id : f.attributes[idField],
					label : f.attributes[labelField],
					feature : f
				}
			})
			
			d.Resolve(items);	
		}, error => {
			d.Reject(error);
		})
		
		return d.promise;
	}
	
	static Identify(layer, geometry) {
		var d = Core.Defer();
		
		Requests.QueryGeometry(layer, geometry).then(r => {
			var locale = Core.locale.toUpperCase();
			var f = r.features[0];
			
			var title = f.attributes[`DisplayNameShort_${locale}`];
			var unit = f.attributes[`UOM_${locale}`];
			var value = f.attributes[`FormattedValue_${locale}`];
			var html = f.attributes[`IndicatorDisplay_${locale}`];
			
			var content = `<b>${unit}</b>: ${value}<br><br>${html}`;
			
			d.Resolve({ feature:f, geometry:geometry, content:content, title:title });
		}, error => d.Reject(error));
		
		return d.promise;
	}
	
	static Placename(id, label) { 
		var d = Core.Defer();
		
		var where = `GeographyReferenceId = '${id}' and SearchDisplayName = '${label}'`;
		
		Requests.QueryUrl(URLS.placename, where, null, true).then(r => {
			d.Resolve(r.features[0]);	
		}, error => {
			d.Reject(error);
		});
		
		return d.promise;
	}
}