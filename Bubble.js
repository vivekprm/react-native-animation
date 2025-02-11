import { StyleSheet } from "react-native";
import Animated, { Extrapolate, interpolate, useAnimatedStyle } from "react-native-reanimated";
import { StyleGuide } from "./components/StyleGuide";

const size = 32;

const styles = StyleSheet.create({
    bubble: {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: StyleGuide.palette.primary,
    },
});

const Bubble = ({ progress, start, end }) => {
    const style = useAnimatedStyle(() => {
        const opacity = interpolate(
            progress.value,
            [start, end],
            [0.5, 1],
            Extrapolate.CLAMP
        );
        const scale = interpolate(
            progress.value,
            [start, end],
            [1, 1.5],
            Extrapolate.CLAMP
        );
        return { opacity, transform: [{ scale }] }
    });
    return <Animated.View style={[style, styles.bubble]} />;
}
export default Bubble;