//This is Lab 2 for Geog575, Spring 2017.
//Author: AAIverson
//Date: 4.11.17
//Purpose: To create a choropleth map with coordinated visualization, dynamically displaying 5 different attributes per enumeration unit (here, US states).

//BEGIN SCRIPT with encompassing empty function
(function(){

//pseudo-global variables
var attrArray = ["ChildWellBeingOverallRank", "EconomicWellBeingRank", "EducationRank", "HealthRank", "FamilyAndCommunityRank"]; //list of attributes
var expressed = attrArray[0]; //initial attribute

//chart frame dimensions
var chartWidth = window.innerWidth * .75,
    chartHeight = 150;

//create a scale to size bars proportionally to frame
var yScale = d3.scaleLinear()
    .range([0, chartHeight])
    .domain([0, 58]); //was [0, 150]

//begin script when window loads
window.onload = setMap();

//Example 1.3 line 4...set up choropleth map
function setMap(){
    //map frame dimensions
    var width = window.innerWidth *0.75,
        height = 600;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on the USA, with Alaska and Hawaii appended
    var projection = d3.geoAlbersUsa()
        //.parallels([25, 50]);
        //.scale(500)
        .translate([width / 2, height / 2]);


    //create path generator
    var path = d3.geoPath()
        .projection(projection);

    //use d3.queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.csv, "data/kidscount2015.csv") //load attributes from csv
        .defer(d3.json, "data/US.topojson") //load choropleth spatial data
        .await(callback);

    function callback(error, kidscount2015, states){
        
        //D3, Leaflet, and other web mapping libraries do not natively support TopoJSON data. Rather, to use our spatial data, we need to convert it back to GeoJSON within the DOM. For this, we will use Mike Bostock's small topojson.js library.
        //topojson.feature() converts the TopoJSON object into a GeoJSON FeatureCollection object
        //translate states Topojson...
        var US = topojson.feature(states, states.objects.US).features;

        //join csv data to GeoJSON enumeration units
        US = joinData(US, kidscount2015);

        //create the color scale
        var colorScale = makeColorScale(kidscount2015);

        //add enumeration units to the map
        setEnumerationUnits(US, map, path, colorScale);

        //add coordinated visualization to the map
        setChart(kidscount2015, colorScale);

        //add menu to map 
        createDropdown(kidscount2015);

        //add dynamic labels
        setLabel(props);

    };

}; //end of setMap()

function joinData (US, kidscount2015){

    //loop through csv to assign each set of csv attribute values to geojson region
    for (var i=0; i<kidscount2015.length; i++){
        var csvRegion = kidscount2015[i]; //the current region
        var csvKey = csvRegion.adm1_code; //the CSV primary key

        //loop through geojson regions to find correct region
        for (var a=0; a<US.length; a++){

            var geojsonProps = US[a].properties; //the current region geojson properties
            var geojsonKey = geojsonProps.adm1_code; //the geojson primary key

            //where primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){

                //assign all attributes and values
                attrArray.forEach(function(attr){
                    var val = parseFloat(csvRegion[attr]); //get csv attribute value
                    geojsonProps[attr] = val; //assign attribute and value to geojson properties
                });
            };
        };
    };

    return US;
};

//function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "#2887a1",
        "#98b7b2",
        "#edeac2",
        "#caa873",
        "#A16928"
    ];

    //create color scale generator
    var colorScale = d3.scaleThreshold()
        .range(colorClasses);

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);
    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d){
        return d3.min(d);
    });
    //remove first value from domain array to create class breakpoints
    domainArray.shift();

    //assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    return colorScale;
};

function setEnumerationUnits(US, map, path, colorScale){
    //add US states to map...this will get moved to set enumeration units
    var statesMap = map.selectAll(".statesMap")
        .data(US)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "statesMap _" + d.properties.adm1_code;
        })
        .attr("d", path)
        // .style("fill", function(d){
        // return colorScale(d.properties[expressed]);
        // });
        .style("fill", function(d){
            return choropleth(d.properties, colorScale)
        })
        .on("mouseover", function(d){
            highlight(d.properties)
        })
        .on("mouseout", function(d){
            dehighlight(d.properties)
        });
    var desc = statesMap.append("desc")
        .text('{"stroke": "#000", "stroke-width": "0.5px"}')

};


//function to test for data value (Null or Nonsensical) and return an identifiable color indicating the error
function choropleth(props, colorScale){
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    
    //if attribute value exists, assign a color; otherwise assign gray
    if (typeof val == 'number' && !isNaN(val)){
        return colorScale(val);
    } else {
        return "#CCC";
    };
};

//function to highlight enumeration units and bars
function highlight(props){
    //change stroke... append ._ to change from number for interpretation
    var selected = d3.selectAll("._" + props.adm1_code)
        .style("stroke", "gold")
        .style("stroke-width", "5");
};

//function to reset the element style on mouseout
function dehighlight(props){
    //append ._ to change from number for interpretation
    var selected = d3.selectAll("._" + props.adm1_code)
        //below Example 2.4 line 21...remove info label
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
    d3.select(".infolabel").remove();
};

//function to create coordinated bar chart
function setChart(kidscount2015, colorScale){

    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    var chartTitle = chart.append("text")
        .attr("x", 300)
        .attr("y", 30)
        .attr("class", "chartTitle")
        .text(expressed + " for each US State");

    //set bars for each state
    var bars = chart.selectAll(".bars")
        .data(kidscount2015)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return a[expressed]-b[expressed]
        })
        .attr("class", function(d){
            return "bar _" + d.adm1_code; //doesn't like numbers, so have to "append" _ to get the highlight to work
        })
        .attr("width", chartWidth / kidscount2015.length - .5) // 1/n-1 pixels for gap between bars
        .on("mouseover", highlight)
        .on("mouseout", dehighlight)
        .attr("x", function(d, i){
            return i * (chartWidth / kidscount2015.length);
        })
        .attr("height", function(d){
            return yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d){
            return chartHeight - yScale(parseFloat(d[expressed]));
        })
        .style("fill", function(d){
            return choropleth(d, colorScale)
        })
        var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');

        

    //annotate bars with attribute value text
    var numbers = chart.selectAll(".numbers")
        .data(kidscount2015)
        .enter()
        .append("text")
        .sort(function(a, b){
            return a[expressed]-b[expressed]
        })
        .attr("class", function(d){
            return "numbers " + d.adm1_code;
        })
        .attr("text-anchor", "middle")
        .attr("x", function(d, i){
            var fraction = chartWidth / kidscount2015.length;
            return i * fraction + (fraction - 1) / 2;
        })
        .attr("y", function(d){
            return yScale(parseFloat(d[expressed])) + 10;
        })
        .text(function(d){
            return d[expressed];
        });

    //set bar positions, heights, and colors
    updateChart(bars, kidscount2015.length, colorScale);
    
}; //end of setChart()

//function to create a dropdown menu for attribute selection
function createDropdown(kidscount2015){
    //add select element to the body
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        //.on() operator to the end of the dropdown block to listen for a "change" interaction on the <select> element 
        .on("change", function(){
            changeAttribute(this.value, kidscount2015)
        }); //We pass it an anonymous function, within which we call our new listener handler, changeAttribute(). kidscount2015 is used to recreate the color scale.

    //add initial option...creates an <option> element with no value attribute and instructional text to serve as an affordance alerting users that they should interact with the dropdown menu
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true") //Disabling the title option ensures that the user cannot mistakenly select it
        .text("Select Ranking Category"); //attribute display text

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray) //attrArray pseudo-global variable that holds an array of our attribute names
        .enter()
        .append("option") //creating one <option> element for each attribute
        .attr("value", function(d){ return d }) //Each option element is assigned a value attribute that holds the name of the attribute, and its text content (what the user sees) is also assigned the name of the attribute 
        .text(function(d){ return d });
};

//dropdown change listener handler
function changeAttribute(attribute, kidscount2015){
    //change the expressed attribute
    expressed = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(kidscount2015);

    //recolor enumeration units
    var statesMap = d3.selectAll(".statesMap")
        .transition()
        .duration(1000)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale)
        });

    //re-sort, resize, and recolor bars
    var bars = d3.selectAll(".bar")
        //re-sort bars
        .sort(function(a, b){
            return a[expressed] - b[expressed];
        })
        .transition() //add animation
        .delay(function(d, i){
            return i * 20
        })
        .duration(500);   

    updateChart(bars, kidscount2015.length, colorScale);

}; //end of changeAttribute()

//function to position, size, and color bars in chart
function updateChart(bars, n, colorScale){
    //position bars
    bars.attr("x", function(d, i){
            return i * (chartWidth / n); //+ leftPadding;
        })
        //size/resize bars
        .attr("height", function(d){
            return 463 - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d){
            return yScale(parseFloat(d[expressed])); //+ topBottomPadding;
        })

        //color/recolor bars
        .style("fill", function(d){
            return choropleth(d, colorScale);
        });

    var chartTitle = d3.select(".chartTitle")
        .text(expressed + " for each US State");

};

//function to create dynamic label
function setLabel(props){
    //label content
    var labelAttribute = "<h1>" + props[expressed] +
        "</h1><b>" + expressed + "</b>";

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.adm1_code + "_label")
        .html(labelAttribute);

    var regionName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.name);
};


})(); //last line of main.js
        