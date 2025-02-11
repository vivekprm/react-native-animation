import { useState } from "react";
import { Button, StyleSheet, View } from "react-native";
import ChatBubble from "./ChatBubble";
import { Easing, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { StyleGuide } from "./components/StyleGuide";
import { withPause } from "react-native-redash";

const style = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "space-between",
        backgroundColor: StyleGuide.palette.background,
    },
});
const Timing = () => {
    const [play, setPlay] = useState(false);
    const paused = useSharedValue(!play);
    const progress = useSharedValue(null);
    return (
        <View style={style.container}>
            <ChatBubble progress={progress} />
            <Button title={play ? "Pause" : "Play"} onPress={() => {
                setPlay((prev) => !prev);
                paused.value = !paused.value;
                if (progress.value === null) {
                    progress.value = withPause(withRepeat(withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }), -1, true), paused);
                }
            }
            } />
        </View>
    )
}
export default Timing;