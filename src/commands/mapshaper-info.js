/* @requires
mapshaper-common
mapshaper-dataset-utils
mapshaper-nodes
mapshaper-projections
*/

internal.printInfo = function(layers, targetLayers) {
  var str = '';
  layers.forEach(function(o, i) {
    var isTarget = Array.isArray(targetLayers) && targetLayers.indexOf(o.layer) > -1;
    var targStr = isTarget ? ' *' : '';
    str += '\n';
    str += 'Layer ' + (i + 1) + targStr + '\n' + internal.getLayerInfo(o.layer, o.dataset);
    str += '\n';
  });
  message(str);
};

internal.getLayerData = function(lyr, dataset) {
  var n = internal.getFeatureCount(lyr);
  var o = {
    geometry_type: lyr.geometry_type,
    feature_count: n,
    null_shape_count: 0,
    null_data_count: lyr.data ? internal.countNullRecords(lyr.data.getRecords()) : n
  };
  if (lyr.shapes) {
    o.null_shape_count = internal.countNullShapes(lyr.shapes);
    o.bbox =internal.getLayerBounds(lyr, dataset.arcs).toArray();
    o.proj4 = internal.getProjInfo(dataset);
  }
  return o;
};

// TODO: consider polygons with zero area or other invalid geometries
internal.countNullShapes = function(shapes) {
  var count = 0;
  for (var i=0; i<shapes.length; i++) {
    if (!shapes[i] || shapes[i].length === 0) count++;
  }
  return count;
};

internal.countNullRecords = function(records) {
  var count = 0;
  for (var i=0; i<records.length; i++) {
    if (!records[i]) count++;
  }
  return count;
};

internal.countRings = function(shapes, arcs) {
  var holes = 0, rings = 0;
  internal.editShapes(shapes, function(ids) {
    var area = geom.getPlanarPathArea(ids, arcs);
    if (area > 0) rings++;
    if (area < 0) holes++;
  });
  return {rings: rings, holes: holes};
};

internal.getLayerInfo = function(lyr, dataset) {
  var data = internal.getLayerData(lyr, dataset);
  var str = "Layer name: " + (lyr.name || "[unnamed]") + "\n";
  str += utils.format("Records: %,d\n",data.feature_count);
  str += internal.getGeometryInfo(data);
  str += internal.getTableInfo(lyr);
  return str;
};

internal.getGeometryInfo = function(data) {
  var lines;
  if (!data.geometry_type) {
    lines = ["Geometry: [none]"];
  } else {
    lines = ["Geometry", "Type: " + data.geometry_type];
    if (data.null_shape_count > 0) {
      lines.push(utils.format("Null shapes: %'d", data.null_shape_count));
    }
    if (data.feature_count > data.null_shape_count) {
      lines.push("Bounds: " + data.bbox.join(' '));
      lines.push("Proj.4: " + data.proj4);
    }
  }
  return lines.join('\n  ') + '\n';
};

internal.getTableInfo = function(lyr, i) {
  if (!lyr.data || lyr.data.size() === 0 || lyr.data.getFields().length === 0) {
    return "Attribute data: [none]";
  }
  return internal.getAttributeInfo(lyr.data, i);
};

internal.getAttributeInfo = function(data, i) {
  return "Attribute data\n" + internal.formatAttributeTable(data, i);
};

internal.formatAttributeTable = function(data, i) {
  var featureId = i || 0;
  var featureLabel = i >= 0 ? 'Value' : 'First value';
  var fields = internal.applyFieldOrder(data.getFields(), 'ascending');
  var col1Chars = fields.reduce(function(memo, name) {
    return Math.max(memo, name.length);
  }, 5) + 2;
  var vals = fields.map(function(fname) {
    return data.getReadOnlyRecordAt(featureId)[fname];
  });
  var maxIntegralChars = vals.reduce(function(max, val) {
    if (utils.isNumber(val)) {
      max = Math.max(max, internal.countIntegralChars(val));
    }
    return max;
  }, 0);
  var table = vals.map(function(val, i) {
    return '  ' + internal.formatTableItem(fields[i], val, col1Chars, maxIntegralChars);
  }).join('\n');
  return '  ' + utils.rpad('Field', col1Chars, ' ') + featureLabel + "\n" + table;
};

internal.formatNumber = function(val) {
  return val + '';
};

internal.formatString = function(str) {
  var replacements = {
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t'
  };
  var cleanChar = function(c) {
    // convert newlines and carriage returns
    // TODO: better handling of non-printing chars
    return c in replacements ? replacements[c] : '';
  };
  str = str.replace(/[\r\t\n]/g, cleanChar);
  return "'" + str + "'";
};

internal.countIntegralChars = function(val) {
  return utils.isNumber(val) ? (internal.formatNumber(val) + '.').indexOf('.') : 0;
};

internal.formatTableItem = function(name, val, col1Chars, integralChars) {
  var str = utils.rpad(name, col1Chars, ' ');
  if (utils.isNumber(val)) {
    str += utils.lpad("", integralChars - internal.countIntegralChars(val), ' ') +
      internal.formatNumber(val);
  } else if (utils.isString(val)) {
    str += internal.formatString(val);
  } else if (utils.isObject(val)) { // if {} or [], display JSON
    str += JSON.stringify(val);
  } else {
    str += String(val);
  }
  return str;
};

internal.getSimplificationInfo = function(arcs) {
  var nodeCount = new NodeCollection(arcs).size();
  // get count of non-node vertices
  var internalVertexCount = internal.countInteriorVertices(arcs);
};

internal.countInteriorVertices = function(arcs) {
  var count = 0;
  arcs.forEach2(function(i, n) {
    if (n > 2) {
      count += n - 2;
    }
  });
  return count;
};
