export interface DataPoint {
    cluster: string, // Most likely cluster
    memberships: number[], // The % memberships of each centroids
    id: string, // Unique identifier
    type: "student" | "centroid",
    position: number[], // Each item is a dimension
    dataset: string
}
export interface ClusterResponse {
    summary: DataPoint[],
    breakdown: {
        field: string, // Engagement, Formative, Summative,
        data: DataPoint[]
    }[]
}

export interface Line {
    x1: number,
    x2: number,
    y1: number,
    y2: number
};
export interface Text {
    x: number,
    y: number,
    dy: number,
    dx: number,
    text: string
};
export interface Circle {
    original: any,
    parent: any,
    cx: number,
    cy: number,
    r: number,
    transform: string
};
export interface ThreeDimension {
    x: number,
    y: number,
    z: number,
    cluster: number,
    fill: string,
    components: number[],
    type: "student" | "centroid",
    id: string
};
export interface ChartConfiguration {
    grid: boolean,
    gridLabels: boolean
    axis: boolean,
    axisLabels: boolean,
};
export interface DisplaySettings {
    width: number,
    height: number,
    depth: number,
    radius: number,
    xView: number,
    yView: number,
    zView: number
};

export interface ValueRange {
    x: number,
    y: number,
    z: number
};

export interface DOMContainer {
    scatter: d3.Selection<Element, Circle, Element, any>,
    axis: d3.Selection<Element, Line, Element, any>,
    grid: d3.Selection<Element, Line, Element, any>,
    axisLabels: d3.Selection<Element, Text, Element, any>,
    gridLabels: d3.Selection<Element, Text, Element, any>
};

export interface DataContainer {
    scatter: Circle[],
    axis: Line[],
    axisLabels: Text[],
    grid: Line[],
    gridLabels: Text[],
    [key: string]: null | any
};
