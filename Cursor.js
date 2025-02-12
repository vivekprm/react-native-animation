import * as React from "react";
import { StyleSheet, View } from "react-native";

import { PanGestureHandler } from "react-native-gesture-handler";
import Animated, { clamp, useAnimatedGestureHandler, useAnimatedStyle } from "react-native-reanimated";
import { canvas2Polar, polar2Canvas } from "react-native-redash";
import { StyleGuide } from "./components/StyleGuide";

export const Cursor = ({ r, strokeWidth, theta, backgroundColor }) => {
    const center = { x: r, y: r };
    const onGestureEvent = useAnimatedGestureHandler({
        onStart: (event, ctx) => {
            ctx.offset = polar2Canvas({ theta: theta.value, radius: r }, center);
        },
        onActive: (event, ctx) => {
            const { translationX, translationY } = event;
            const x = ctx.offset.x + translationX;
            const y1 = ctx.offset.y + translationY;
            const y = x < r ? y1 : (theta.value < Math.PI ? clamp(y1, 0, r - 0.001) : clamp(y1, r, 2 * r))
            const value = canvas2Polar({ x, y }, center).theta;
            theta.value = value > 0 ? value : 2 * Math.PI + value;
            console.log({
                before: value,
                after: theta.value,
            })
        }
    });
    const style = useAnimatedStyle(() => {
        const { translateX, translateY } = polar2Canvas({ theta: theta.value, radius: r }, center);
        return {
            backgroundColor: backgroundColor.value,
            transform: [
                { translateX },
                { translateY }
            ]
        }
    })
    return (
        <PanGestureHandler {...{ onGestureEvent }}>
            <Animated.View
                style={[
                    {
                        ...StyleSheet.absoluteFillObject,
                        width: strokeWidth,
                        height: strokeWidth,
                        borderRadius: strokeWidth / 2,
                        borderColor: "white",
                        borderWidth: 5,
                        backgroundColor: StyleGuide.palette.primary,
                    },
                    { style }
                ]}
            />
        </PanGestureHandler>
    );
};