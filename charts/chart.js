import Axes from "./axes.js"
import Tooltip from "../ui/tooltip.js"

/**
 * @description 
 * The parent class for all chart types (bar, pie, etc.).
 * Please refer to the the README in the charts folder for 
 * more information on the overall workflow and overview of 
 * the D3 concepts. 
 */
export default class Chart { 

	set data(value) { this._data = value; }
	
	get data() { return this._data; }

    get svg() { return this._svg; }

    constructor(options) {
		this.data = options.data;
        this.options = options;
		
        // Set a padding value for the dimensions
        this.padding = 25

        // A tooltip that will appear over some chart element
        this.tooltip = new Tooltip();

        // The container where chart elements will be held
        this.container = d3.select(this.options.element);

        this._svg = this.AppendSVGtoContainerElement();

        this.BuildDimensions();

        this.AddGroupToSVG();
    }

    GetColor() {
        return d3.scaleOrdinal(d3.schemeCategory20);
    }

    /**
     * @description 
     * Take the container element and append an SVG to it.
     */
    AppendSVGtoContainerElement() {
        return this.container.append("svg")
					  .attr("width", +this.options.element.getAttribute("width"))
					  .attr("height", +this.options.element.getAttribute("height"));
    }

    /**
     * @description
     * Dimensions are defined here for developing the chart. 
     * Either a SME will define their own dimensions or use 
     * default dimensions set by the programmer. 
     */
    BuildDimensions() {
        this.dimensions = this.options.dimensions || null;

        if (!this.dimensions) this.SetDefaultDimensions(); 
    }

    /**
     * @description
     * Default dimensions set developing the chart. 
     */
    SetDefaultDimensions() {
        let margin = {top: 20, bottom: 70, right: 0, left: 55};
        let width = +this.svg.attr("width") - this.padding;
        let height = +this.svg.attr("height") - this.padding;

		// Note: Not a big fan of holding variables (margin, width and height) and derived values (both inners)
		//		 What happens if width or height change? I wonder if it's worth it to build a "dimensions" object
		// 		 that handles these issues. I built an example, see dimensions.js. May be overkill for now though.
        this.dimensions = {
			margin : margin,
			width:  width,
			height: height,
			innerWidth: width - margin.left - margin.right,
			innerHeight : height - margin.top - margin.bottom
		}
    }

    /**
     * @description
     * Put the group within the view of the SVG.
     */
    AddGroupToSVG() {
        this.g = this.svg.append('g').attr(
            'transform', 
            `translate(${this.dimensions.margin.left}, ${this.dimensions.margin.top})`
        );
    }

    /**
     * @description
     * Some charts may require a column separator, so a vertical grid
     * line should be built using the xScale and innerHeight.
     */
    BuildGridLineVertical() {
        this.g.selectAll("g.x.axis-grid")
            .call(Axes.GridLineVertical(this.xScale, this.dimensions.innerHeight));
    }

    /**
     * @description
     * Some charts (bar, line, and scatter) may require a row separator, 
     * so a horizontal grid line should be built using the yScale and innerWidth.
     */
    BuildGridLineHorizontal() {
        this.g.selectAll("g.y.axis-grid")
            .call(Axes.GridLineHorizontal(this.yScale, this.dimensions.innerWidth));
    }

    /**
     * @description
     * Using the scales, the axes are built for some charts (bar, line, and scatter).
     * Building the axes is only performed once for any given chart type. The text on 
     * the bottom axis requires pre-processing to avoid texting leaving the SVG. 
     */
    BuildAxes() { 
        // Left (vertical) axis
        this.g.append('g')
            .call(d3.axisLeft(this.yScale).ticks())
            .classed("left axis", true);
        
        // Bottom (horizontal) axis
        this.g.append('g')
            .classed("bottom axis", true)
            .attr("transform", `translate(0, ${this.dimensions.innerHeight})`);

        this.SetBottomAxisAttributes();
    }

    /**
     * @description
     * To update the axes on some chart, the xScale and yScale domains must be updated.
     * The xScale is updated in the child classes as the attributes are dependent on 
     * the chart type whereas the yScale is simply updated below. 
     */
    UpdateAxes() {
        this.SetBottomAxisAttributes();
        
		// Note: For readability, I suggest computing the domain ahead		
		var domain = [d3.max(this.data, (d) => d.value), 0];
		var axis = d3.axisLeft(this.yScale.domain(domain)).ticks()
		
        this.g
			.selectAll("g.left.axis")
			.call(axis);
    }

    /**
     * @description
     * Draw the bottom horizontal axis on the group element, and adjust the elements 
     * at the tick marks to not exceed the extent of the SVG.
     */
     SetBottomAxisAttributes () {
        let translateX = -10;
        let angle = -45;
		
        this.g
            .selectAll("g.bottom.axis")
            .call(d3.axisBottom(this.xScale))
            .selectAll("text")
            .attr("transform", `translate(${translateX}, 0)rotate(${angle})`)
            .text((d) => {
				return d.length > 15 ? d.substring(0, 13) + "..." : d;
			})
            .style("text-anchor", "end");
    }

    /**
     * @description
     * When you enter into a chart element (slice of a pie, dot on a scatter plot, etc.),
     * the element will show a tooltip 
     * @param {String} title - Current chart element title
     * @param {String} value - Current chart element value
     * @param {Element} current - Current chart element (pie slice, dot on scatter plot, etc.)
     */
    OnMouseEnter(title, value, current) {
        d3.select(current).style("opacity", 0.5);

        this.tooltip.content = `${title}` + "<br/>" + `Value: ` + `${value}`;
    }

    /**
     * @description
     * The tooltip will move with the new mouse position
     * within the chart element
     */
    OnMouseMove() {
        this.tooltip.Show(d3.event.pageX + 10, d3.event.pageY - 28)
    }

    /**
     * @description
     * Activates once the mouse leaves the chart element
     * @param {Element} current - Current chart element (pie slice, dot on scatter plot, etc.)
     */
    OnMouseLeave(current) {
        d3.select(current).style("opacity", 1);
		
        this.tooltip.Hide()
    }
}