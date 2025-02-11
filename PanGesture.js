import React from "react"
import { View, StyleSheet } from "react-native"
import Animated, {
    useAnimatedGestureHandler,
    useSharedValue,
    useAnimatedStyle,
    clamp
} from "react-native-reanimated"
import { PanGestureHandler } from "react-native-gesture-handler"
import { withDecay, withBounce } from "./AnimationHelper"
import { Card, CARD_HEIGHT, CARD_WIDTH, Cards } from "./components/Card"

const styles = StyleSheet.create({
    container: {
        flex: 1
    }
})

const Gesture = ({ width, height }) => {
    const boundX = width - CARD_WIDTH
    const boundY = height - CARD_HEIGHT
    const translateX = useSharedValue(0)
    const translateY = useSharedValue(0)
    const onGestureEvent = useAnimatedGestureHandler({
        onStart: (_, ctx) => {
            ctx.offsetX = translateX.value
            ctx.offsetY = translateY.value
        },
        onActive: (event, ctx) => {
            translateX.value = clamp(ctx.offsetX + event.translationX, 0, boundX)
            translateY.value = clamp(ctx.offsetY + event.translationY, 0, boundY)
        },
        onEnd: ({ velocityX, velocityY }) => {
            translateX.value = withBounce(withDecay(velocityX), 0, boundX);
            translateY.value = withBounce(withDecay(velocityY), onGestureEvent, boundY);
        }
    })
    const style = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value }
            ]
        }
    })
    return (
        <View style={styles.container}>
            <PanGestureHandler {...{ onGestureEvent }}>
                <Animated.View {...{ style }}>
                    <Card card={Cards.Card1} />
                </Animated.View>
            </PanGestureHandler>
        </View>
    )
}

export default Gesture
