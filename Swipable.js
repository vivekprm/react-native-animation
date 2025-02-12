import { PanGestureHandler } from "react-native-gesture-handler";
import { A, Profile } from "./Profile";
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedGestureHandler, useSharedValue, withSpring } from "react-native-reanimated";
import { Dimensions, StyleSheet } from "react-native";
import { snapPoint } from "react-native-redash";
import { forwardRef, useImperativeHandle } from "react";

const swipe = (translateX, dest, velocityX, onSwipe) => {
    "worklet";
    translateX.value = withSpring(dest, { velocity: velocityX, restSpeedThreshold: dest === 0 ? 0.01 : 100, restDisplacementThreshold: dest === 0 ? 0.01 : 100 }, () => {
        if (dest !== 0) {
            // run the side-effect on JS thread
            runOnJS(onSwipe)();
        }
    });
}
const snapPoints = [-A, 0, A];
const { width } = Dimensions.get("window");
const Swipeable = ({ scale, profile, onTop, onSwipe }, ref) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    useImperativeHandle(ref, () => ({
        swipeLeft: () => {
            swipe(translateX, -A, 25, onSwipe);
        },
        swipeRight: () => {
            swipe(translateX, A, 25, onSwipe);
        }
    }))
    const onGestureEvent = useAnimatedGestureHandler({
        onStart: (_, ctx) => {
            ctx.x = translateX.value;
            ctx.y = translateY.value;
        },
        onActive: ({ translationX, translationY }, ctx) => {
            translateX.value = translationX + ctx.x;
            translateY.value = translationY + ctx.y;
            scale.value = interpolate(translateX.value, [-width / 2, 0, width / 2], [1, 0.95, 1], Extrapolation.CLAMP)
        },
        onEnd: ({ velocityX, velocityY }) => {
            // snapPoint calculates the closest point based on the velocity to snap
            const dest = snapPoint(translateX.value, velocityX, snapPoints);
            swipe(translateX, dest, velocityX, onSwipe);
            translateY.value = withSpring(0, { velocity: velocityY });
        }
    })
    return (
        <PanGestureHandler {...{ onGestureEvent }}>
            <Animated.View style={StyleSheet.absoluteFill}>
                <Profile profile={profile} onTop={onTop} translateX={translateX} translateY={translateY} scale={scale} />
            </Animated.View>
        </PanGestureHandler>
    );
};

export default forwardRef(Swipeable);