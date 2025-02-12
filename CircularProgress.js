import { StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { StyleGuide } from "./components/StyleGuide";
import Animated, { useAnimatedProps } from "react-native-reanimated";

const { PI } = Math;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const CircularProgress = ({ theta, r, strokeWidth, backgroundColor }) => {
    const radius = r - strokeWidth / 2;
    const circumference = radius * 2 * PI;
    const props = useAnimatedProps(() => {
        return {
            stroke: backgroundColor.value,
            strokeDashoffset: theta.value * radius,
        }
    })
    return (
        <Svg style={StyleSheet.absoluteFill}>
            <Circle
                cx={r}
                cy={r}
                fill="transparent"
                stroke="white"
                r={radius}
                {...{ strokeWidth }}
            />
            <AnimatedCircle
                animatedProps={props}
                cx={r}
                cy={r}
                fill="transparent"
                r={radius}
                stroke={StyleGuide.palette.primary}
                strokeDasharray={`${circumference}, ${circumference}`}
                {...{ strokeWidth }}
            />
        </Svg>
    );
};