// put all the underscore templates here
var templates = {
    //*/
    urls: {
        sentData: _.template("http://<%- myria %>/logs/sent?queryId=<%- query %>&fragmentId=<%- fragment %>"),
        profiling: _.template("http://<%- myria %>/logs/profiling?queryId=<%- query %>&fragmentId=<%- fragment %>&start=<%- start %>&end=<%- end %>&onlyRootOp=<%- onlyRootOp %>&minLength=<%- minLength %>"),
        range: _.template("http://<%- myria %>/logs/range?queryId=<%- query %>&fragmentId=<%- fragment %>"),
        contribution: _.template("http://<%- myria %>/logs/contribution?queryId=<%- query %>&fragmentId=<%- fragment %>"),
        histogram: _.template("http://<%- myria %>/logs/histogram?queryId=<%- query %>&fragmentId=<%- fragment %>&start=<%- start %>&end=<%- end %>&step=<%- step %>")
    },
    /*/
    urls: {
        sentData: _.template("/data/sent_<%- query %>_<%- fragment %>.csv"),
        profiling: _.template("/data/profiling_<%- query %>_<%- fragment %>.csv"),
        histogram: _.template("/data/histogram_<%- query %>_<%- fragment %>.csv")
    },/**/
    titleTemplate: _.template("<strong><%- name %></strong> <small><%- type %></small>"),
    stateTemplate: _.template("<span style='color: <%- color %>'><%- state %></span>: <%- time %>"),
    duration: _.template("<br/>took <%- duration %>"),
    numTuplesTemplate: _.template("<br/><%- numTuples %> tuples returned"),
    nullReturned: _.template("<br/>null returned"),
    chartTooltipTemplate: _.template("Time: <%- time %>, #: <%- number %>"),
    ganttTooltipTemplate: _.template("Time: <%- time %>"),
    graphViz: {
        nodeStyle: _.template('[style="rounded, filled",color="<%- color %>",shape=box,label="<%- label %>"];\n'),
        clusterStyle: _.template('\n\tsubgraph cluster_<%- fragment %> {\n\t\tstyle="rounded, filled";\n\t\tcolor=lightgrey;\n\t\tlabel="<%- label %>";\n\t\tnode [style=filled,color=white];\n'),
        link: _.template("\t\"<%- u %>\" -> \"<%- v %>\";\n")
    },
    nwTooltip: _.template("<%- sumTuples %> tuples from <%- src %> to <%- dest %>"),
    nwPointTooltip: _.template("<%- numTuples %> tuples at time <%- time %>"),
    nwLineTooltip: _.template("from <%- src %> to <%- dest %>"),
    barTooltip: _.template("Worker: <%- worker %>, # Tuples: <%- numTuples %>"),
    titleNetworkVis: _.template("Communication between workers from fragment <%- src %> to fragment <%- dst %>"),
    titleFragmentsVis: _.template("Operators inside fragment <%- fragment %>"),
    titleFragmentsOverview: _.template("Overview over all fragments"),
    fragmentTitle: _.template("Fragment <%- fragment %>:"),
    markerUrl: _.template("url(#<%- name %>)"),
    table: _.template('<div class="table-responsive"><table class="table table-striped table-condensed"><tbody><%= body %></tbody></table></div>'),
    row: _.template('<tr><th><%- key %></th><td><%= value %></td></tr>'),
    networkVisFrames:
        '<div class="row">\
            <div class="col-md-4">\
                <h3>Summary</h3><p class="summary"></p>\
            </div>\
            <div class="col-md-8 lines">\
                <h4>Details about when communication occurred</h4>\
            </div>\
        </div>\
        <div class="row"><div class="col-md-12 controls form-inline"></div></div>\
        <div class="row">\
            <div class="col-md-12 matrix"></div>\
        </div>',
    fragmentVisFrames:
        '<h4>Query time contribution <a href="#contribCollapsible" data-toggle="collapse"><small>collapse/expand</small></a></h4>\
        <div class="contrib collapse in" id="contribCollapsible"></div>\
        <h4>Detailed execution</h4>\
        <div class="details" id="detailsCollapsible"></div>',
    defList: _.template('<dl class="dl-horizontal"><%= items %></dl>'),
    defItem: _.template('<dt><%- key %></dt><dd><%- value %></dd>'),
    strong: _.template('<strong><%- text %></strong>'),
    code: _.template('<pre><%- code %></pre>')
};

// Dictionary of operand name -> color
var opToColor = {};

// Color pallet
var opColors = d3.scale.category20();

var animationDuration = 500,
    shortDuration = 200,
    longDuration = 800,
    delayTime = 20;

var dpi = 96;

function timeFormat(formats) {
  return function(date) {
    var i = formats.length - 1, f = formats[i];
    while (!f[1](date)) f = formats[--i];
    return f[0](date);
  };
}

function timeFormatNs(formats) {
  return function(date) {
    if (date === 0) {
        return "0";
    }
    if (date % 1e6 !== 0) {
        return (date % 1e6).toExponential(2) + " ns";
    }

    return timeFormat(formats)(new Date(date/1e6 + new Date().getTimezoneOffset() * 6e4));
  };
}

var customTimeFormat = timeFormatNs([
  [d3.time.format("%H:%M"), function(d) { return true; }],
  [d3.time.format("%H:%M:%S"), function(d) { return d.getMinutes(); }],
  [d3.time.format("%S s"), function(d) { return d.getSeconds(); }],
  [d3.time.format(".%L s"), function(d) { return d.getMilliseconds(); }]
]);

String.prototype.hashCode = function(){
    var hash = 0, i, char;
    if (this.length === 0) return hash;
    for (i = 0, l = this.length; i < l; i++) {
        char  = this.charCodeAt(i);
        hash  = ((hash<<5)-hash)+char;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

function divmod(a, b) {
    return [Math.floor(a/b), a%b];
}

function debug(d) {
    console.log(d);
}

function customFullTimeFormat(d) {
    var str = "", ms, ns, s, m, h, x;

    x = divmod(d, 1e6);
    ns = x[1];
    x = divmod(x[0], 1000);
    ms = x[1];
    x = divmod(x[0], 60);
    s = x[1];
    x = divmod(x[0], 60);
    m = x[1];
    h = x[0];

    if (h) {
        str += h + " H ";
    }
    if (m) {
        str += m + " m ";
    }
    if (s) {
        str += s + " s ";
    }
    if (ms) {
        if (s) {
            str += d3.format("03d")(ms) + " ms ";
        } else {
            str += ms + " ms ";
        }
    }
    str += d3.format("06d")(ns) + " ns ";
    return str;
}

var largeNumberFormat = d3.format(",");

var ruler = d3.select("body")
    .append("div")
    .attr("class", "ruler");

var defaultNumSteps = 1000;

// if a range longer than this time is requests in the fragment visualization, then the
// data is limited to root operators
var maxTimeForDetails = 30 * 1e9;

// reconstruct all data, the data from myria has missing values where no workers were active
function reconstructFullData(incompleteData, start, end, step) {
    var range = _.range(start, end, step),
        data = [],
        indexed = _.object(_.map(incompleteData, function(x){return [x.nanoTime, x.numWorkers]})),
        c = 0;
    _.each(range, function(d) {
        var value = indexed[d];
        if (value !== undefined) {
            c++;
        }
        data.push({
            nanoTime: d,
            numWorkers: value !== undefined ? value : 0
        });
    });

    if (c != incompleteData.length) {
        debug(incompleteData)
        debug(data)
        debug(range)
        console.error("Incomplete data");
    }

    return data;
}

function nameMappingFromFragments(fragments) {
    var idNameMapping = {};
    _.each(fragments, function(frag) {
        _.each(frag.operators, function(op) {
            var hasName = _.has(op, 'opName') && op.opName;
            idNameMapping[op.opId] = hasName ? op.opName.replace("Myria", "") : op.opId;
        });
    });
    return idNameMapping;
}
