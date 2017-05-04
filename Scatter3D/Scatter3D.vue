<template>
    <div class="chart">
        <md-chip class="tooltip" v-bind:class="tooltip.class" v-bind:style="tooltip.style">{{ tooltip.text }}</md-chip>
        <svg class="centre" @mousedown="mousedown" @mouseup="mouseup" @mousemove="mousemove" xmlns="http://www.w3.org/2000/svg" v-bind:style="{width: viewPort.width+'px', height: viewPort.height+'px'}">
            <g class="axis">
                <g class="axisLines">
                    <line v-for="x in calculatedData.axis" :x1="x.x1" :x2="x.x2" :y1="x.y1" :y2="x.y2"></line>
                </g>
                <g class="axisLabels">
                    <text v-for="x in calculatedData.axisLabels" :dy="x.dy" :dx="x.dx" :y="x.y" :x="x.x" text-anchor="middle">{{x.text}}</text>
                </g>
                <g class="axisGrid">
                    <line v-for="x in calculatedData.grid" :x1="x.x1" :x2="x.x2" :y1="x.y1" :y2="x.y2"></line>
                </g>
                <g class="gridLabels">
                    <text v-for="x in calculatedData.gridLabels" :dy="x.dy" :dx="x.dx" :y="x.y" :x="x.x" text-anchor="middle">{{x.text}}</text>
                </g>
            </g>
            <g class="points">
                <circle v-for="x in calculatedData.scatter"
                    :key="x.original.id"
                    v-bind:class="{centroid: x.original.type == 'centroid'}"
                    :fill.once="x.fill"
                    :r.once="x.r"
                    :transform="x.transform"
                    @click="circleClick($event, x)"
                    @mousemove="circleHover($event, x)"
                    @mouseout="circleLeave($event, x)"></circle>
            </g>
        </svg>
    </div>
</template>

<style scoped>
    svg, .tooltip {
        user-select: none;
    }
    svg .axisLines line,
    svg .axisGrid line {
        stroke: #333;
        stroke-width: 1px;
        opacity: 0.15;
    }

    svg .points circle:hover {
        stroke-width: 2px !important;
    }


    svg circle {
        stroke: #000;
        stroke-width: 0.5px
    }

    svg circle.selected {
        opacity: 1 !important;
    }

    svg circle.hidden {
        opacity: 0.1;
    }

    svg circle.centroid.hidden {
        stroke: 0.5px;
        opacity: 1;
    }

    .tooltip {
        z-index: 1000;
        position: fixed;

        color: #fff;
        pointer-events: none;
        opacity: 0;
    }

    .tooltipVisible {
        opacity: 0.75
    }

    .md-theme-default.md-chip {
        background-color: #333;
    }
</style>

<script lang="ts">
import { Vue, Component, Prop, Lifecycle } from "av-ts";
import {
    ThreeDimension, ChartConfiguration, DisplaySettings, ValueRange, Circle,
    DataContainer
} from "../types/ScatterChart3D";

@Component()
export default class ScatterChart3D extends Vue {
    @Prop propData;


    tooltipTimeout = -1;
    tooltip = {
        style: {
            left: "0px",
            top: "0px"
        },
        class: {
            tooltipVisible: false
        },
        text: ""
    };

    calculatedData = {
        scatter: [],
        axis: [],
        axisLabels: [],
        grid: [],
        gridLabels: []
    };

    private yaw: number = Math.PI / 8;
    private pitch: number = -6.25 * Math.PI / 4;

    // The input data to transform
    private chartData: ThreeDimension[];

    // Chart configuration and screen setting sizes.
    private chartConfiguration: ChartConfiguration;

    // By default screen size is the same as parent container
    private viewPort: DisplaySettings = {
        width: 0,
        height: 0,
        depth: 0,
        radius: 0,
        xView: 0,
        yView: 0,
        zView: 0
    };

    // Minimum and maximum values of the dataset. Used to calculate axis ranges
    private minV: ValueRange = { x: 0, y: 0, z: 0 };
    private maxV: ValueRange = { x: 0, y: 0, z: 0 };

    private drag = [];
    mousedown(e) {
        if (e.button != 0) return;
        this.drag = [[e.pageX, e.pageY], this.yaw, this.pitch];
    }
    mousemove(e) {
        if (this.drag.length == 0) return;
        this.yaw = this.drag[1] + (e.pageX- this.drag[0][0]) / 50;
        this.pitch = this.drag[2] + (e.pageY - this.drag[0][1]) / 50;
        this.$emit("drag", [this.yaw, this.pitch]);
    }
    mouseup(e) {
        this.drag = [];
    }

    @Lifecycle
    mounted() {
        this.chartData = JSON.parse(JSON.stringify(this.propData));

        let xVals: number[] = this.chartData.map(x => x.x);
        let yVals: number[] = this.chartData.map(x => x.y);
        let zVals: number[] = this.chartData.map(x => x.z);

        this.minV.x = Math.min(...xVals);
        this.maxV.x = Math.max(...xVals);

        this.minV.y = Math.min(...yVals);
        this.maxV.y = Math.max(...yVals);

        this.minV.z = Math.min(...zVals);
        this.maxV.z = Math.max(...zVals);;

        let bBox = this.$el.getBoundingClientRect();
        this.setDimensions({
            width: bBox.width,
            height: bBox.height,
            depth: (bBox.width + bBox.height) / 2,
            xView: bBox.width / 2,
            yView: bBox.height / 2,
            zView: (bBox.width + bBox.height) / 4,
            radius: Math.min(bBox.width / 2, bBox.height / 2)
        });


        this.redraw();
    }

    /**
    * Sets the chart dimensions such as width and height
    */
    setDimensions(settings: DisplaySettings): ScatterChart3D {
        this.viewPort = settings;
        return this;
    };

    /**
    * Rotates the chart perspective
    */
    turntable(yaw: number, pitch: number): ScatterChart3D {
        this.yaw = yaw;
        this.pitch = pitch;
        return this;
    };

    /**
    * Returns a function which rotates points in a 3D plane.
    */
    private getRotator(yaw, pitch) {
        let xCos = Math.cos(pitch);
        let xSin = Math.sin(pitch);
        let yCos = Math.cos(yaw);
        let ySin = Math.sin(yaw);

        return (x, y, z) => {
            let vals = { x: x, y: y, z: z };

            // X Rotation (up/down)
            // Preserve x,y,z for the calculations into temporary x,y,z,
            // then overwrite vals[x,y,z] so that other transofrmations work
            y = vals.y * xCos - vals.z * xSin,
                z = vals.z * xCos + vals.y * xSin;
            vals = { x: vals.x, y: y, z: z };

            // Y Rotation (left/right)
            x = vals.x * yCos - vals.z * ySin;
            z = vals.z * yCos + vals.x * ySin;
            vals = { x: x, z: z, y: vals.y };

            // Z Rotation  (not used)
            //x = vals.x * yCos - vals.y * ySin;
            //y = vals.y * yCos + vals.x * ySin;
            //vals = {x: x, y: y, z: vals.z}
            return vals;
        };
    }

    /**
    * Returns an object which has vectors that define the chart axis
    */
    private generateAxisDimensions() {
        let xView = this.viewPort.xView;
        let yView = this.viewPort.yView;
        let zView = this.viewPort.zView;
        let depth = this.viewPort.depth;
        let height = this.viewPort.height;
        let width = this.viewPort.width;
        return [{ // Y
            type: "y",
            view: this.viewPort.yView,
            intersect: {
                x: [-(this.viewPort.width - xView) / 2, (width - xView) / 2],
                z: [-(depth - zView) / 2, (depth - zView) / 2]
            },
            x0: -(width - xView) / 2, x1: -(width - xView) / 2,
            y0: -(height - yView) / 2 + yView, y1: -(height - yView) / 2,
            z0: -(depth - zView) / 2, z1: -(depth - zView) / 2
        }, { // X
            type: "x",
            view: xView,
            intersect: {
                y: [-(height - yView) / 2, (height - yView) / 2],
                z: [-(depth - zView) / 2, (depth - zView) / 2]
            },
            x0: -(width - xView) / 2 + xView, x1: -(width - xView) / 2,
            y0: -(height - yView) / 2, y1: -(height - yView) / 2,
            z0: -(depth - zView) / 2, z1: -(depth - zView) / 2
        }, { // Z
            type: "z",
            view: zView,
            intersect: {
                x: [xView / 2, -xView / 2],
                y: [-(height - yView) / 2, (yView) / 2]
            },
            x0: -(width - xView) / 2, x1: -(width - xView) / 2,
            y0: -(height - yView) / 2, y1: -(height - yView) / 2,
            z0: (depth - zView) / 2, z1: ((depth - zView) / 2) - zView
        }];
    }

    /**
    *  Generates the chart axis data (such as the ticks, grid, and axis labels)
    */
    private getAxisData(dimensions, applyRotation, normalise): DataContainer {
        return dimensions.reduce((carry: DataContainer, point) => {
            // Axis should always be cutting through the same set of points.
            let tOrigins = applyRotation(point.x0, point.y0, point.z0);
            let tEnds = applyRotation(point.x1, point.y1, point.z1);
            // Push axis label
            let label = {
                x: point.x0 + (point.type == "x" ? 40 : 0),
                y: point.y0 + (point.type == "y" ? 40 : 0),
                z: point.z0 + (point.type == "z" ? 40 : 0)
            };
            let labelMap = {
                "x": "Formative",
                "y": "Summative",
                "z": "Enagement"
            };
            let labelPos = applyRotation(label.x, label.y, label.z);
            carry.axisLabels.push({
                dx: labelPos.x + this.viewPort.width / 2,
                dy: labelPos.y + this.viewPort.height / 2,
                y: 0, x: 0,
                text: labelMap[point.type]
            });
            carry.axis.push({
                x1: tOrigins.x + this.viewPort.width / 2,
                x2: tEnds.x + this.viewPort.width / 2,
                y1: tOrigins.y + this.viewPort.yView,
                y2: tEnds.y + (this.viewPort.height - this.viewPort.yView)
            });

            const scale = v => {
                return (v - this.minV[point.type]) / (this.maxV[point.type] - this.minV[point.type])
            }
            let axisValues = Array(11).fill(0).map((_, i) => i/10)

            axisValues.forEach(tickValue => {
                let xDiff = this.viewPort.width - this.viewPort.xView;
                let yDiff = this.viewPort.height - this.viewPort.yView;
                let zDiff = this.viewPort.depth - this.viewPort.zView;
                for (let t = 0; t < 2; t++) {
                    let offset = normalise(tickValue, point.type, point.view);

                    let line = {
                        x0: point.type == "x" ? offset : -(xDiff) / 2,
                        x1: point.type == "x" ? offset : point.intersect.x[t],
                        y0: point.type == "y" ? offset : -(yDiff) / 2,
                        y1: point.type == "y" ? offset : point.intersect.y[t],
                        z0: point.type == "z" ? offset : -(zDiff) / 2,
                        z1: point.type == "z" ? offset : -point.intersect.z[t]
                    };

                    // Draw line from current axis to both of other axis.
                    // x-> y, x-> z, y-> x, y->z, etc.
                    let tOrigins = applyRotation(line.x0, line.y0, line.z0);
                    let tEnds = applyRotation(line.x1, line.y1, line.z1);

                    carry.gridLabels.push({ // Tick Labels
                        dx: tOrigins.x + this.viewPort.width / 2,
                        dy: tOrigins.y + this.viewPort.height / 2,
                        y: 0, x: 0,
                        text: tickValue
                    });

                    carry.grid.push({ // Grid Lines
                        x1: tOrigins.x + this.viewPort.width / 2,
                        x2: tEnds.x + this.viewPort.width / 2,
                        y1: tOrigins.y + this.viewPort.height / 2,
                        y2: tEnds.y + (this.viewPort.height / 2)
                    });
                }
            });

            return carry;
        }, {
            axis: [],
            axisLabels: [],
            grid: [],
            gridLabels: []
        });
    }

    /**
    *  Calculates the position of each scatter point, and also generates the axis information
    */
    private calculatePositions(): void {
        let applyRotation = this.getRotator(this.yaw, this.pitch);
        let normalise = (value, axis, range): number => {
            let numerator = value - this.minV[axis];
            let denominator = this.maxV[axis] - this.minV[axis];
            return (numerator / denominator) * range - (range / 2);
        };

        let dataContainer: DataContainer = {
            scatter: [],
            axis: [],
            axisLabels: [],
            grid: [],
            gridLabels: []
        };

        let mapScatterPoints: (point: ThreeDimension) => Circle = point => {
            // Normalise points in range of min/max
            let x = normalise(point.x, "x", this.viewPort.xView);
            let y = normalise(point.y, "y", this.viewPort.yView);
            let z = normalise(point.z, "z", this.viewPort.zView);
            let rotation = applyRotation(x, y, z);
            let xTrans = `${rotation.x + this.viewPort.width / 2}`;
            let yTrans = `${rotation.y + this.viewPort.height / 2}`;
            return {
                transform: `translate (${xTrans}, ${yTrans})`,
                cx: rotation.x + this.viewPort.width / 2,
                cy: rotation.y + this.viewPort.height / 2,
                fill: point.fill,
                original: point,
                r: point.type == "centroid" ? 0 : 2.5,
                parent: point
            };
        };

        if (this.calculatedData.scatter.length != this.chartData.length) {
            this.calculatedData.scatter = this.chartData.map(mapScatterPoints);
        } else {
            this.chartData.forEach((scatter, index) => {
                this.calculatedData.scatter[index].transform =
                    mapScatterPoints(scatter).transform;
            });
        }

        let axisData = this.getAxisData(this.generateAxisDimensions(),
            applyRotation, normalise);

        this.calculatedData.axis = axisData.axis;
        this.calculatedData.axisLabels = axisData.axisLabels;
        this.calculatedData.grid = axisData.grid;
        this.calculatedData.gridLabels = axisData.gridLabels;
    };

    circleClick = (e, node: Circle) => {
        this.$emit("circleClick", node);
    }

    circleHover = (e, node: Circle) => {
        if (this.tooltipTimeout != -1) {
            clearTimeout(this.tooltipTimeout);
        }
        this.tooltip.style.left = (e.clientX + 10) + "px";
        this.tooltip.style.top = (e.clientY - 20) + "px";
        this.tooltip.class.tooltipVisible = true;
        this.tooltip.text =
            `${node.original.x.toFixed(2)},` +
            `${node.original.y.toFixed(2)},` +
            `${node.original.z.toFixed(2)}`;
        this.$emit("circleHover", node);
    }
    circleLeave = e => {
        if (this.tooltipTimeout != -1) {
            clearTimeout(this.tooltipTimeout);
        }

        this.tooltipTimeout = setTimeout(() => {
            this.tooltip.class.tooltipVisible = false;
        }, 100);
        this.$emit("circleLeave", e);
    }

    /**
    * Re-calcualtes data positions and draws them on the DOM
    */
    redraw(): ScatterChart3D {
        let bBox = this.$el.parentElement.getBoundingClientRect();
        this.setDimensions({
            width: bBox.width,
            height: bBox.height,
            depth: (bBox.width + bBox.height) / 2,
            xView: bBox.width / 2,
            yView: bBox.height / 2,
            zView: (bBox.width + bBox.height) / 4,
            radius: Math.min(bBox.width / 2, bBox.height / 2)
        });

        this.calculatePositions();

        return this;
    };
}
</script>
