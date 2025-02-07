What makes react native so specific when talking about gestures and animations?
The key to success is to avoid frame drops, which means that we have only 16ms to render everything, now 8ms on some devices.

# Simplified Architecture

We have the JavaScript thread, that runs the react code and the native thread that interacts with all the native APIs of the device. They talk to each other via asynchronous JSON messages.
So If the JavaScript thread is busy rendering your components or dealing with API calls, you are likely to miss this 16ms timeframe within your animation, or if your animation relies on messeges being exchanged between the native thread and the JavaScript thread, you are also likey to drop frames because the messegs won't be exchanged within that 16ms window.

```js
import React from "react";
import { Animated, PanResponder, StyleSheet, View } from "react-native";
import useMakeJSThreadBusy from "./useMakeJSThreadBusy";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  ball: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "red",
  },
});

const HeartOfTheMatter = () => {
  const position = new Animated.ValueXY({ x: 0, y: 0 });
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: () => {
      position.setOffset({
        x: position.x._value,
        y: position.y._value,
      });
      position.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: Animated.event(
      [null, { dx: position.x, dy: position.y }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: () => {
      position.flattenOffset();
    },
  });
  useMakeJSThreadBusy(true, 1000);
  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.ball, position.getLayout()]}
        {...panResponder.panHandlers}
      />
    </View>
  );
};
export default HeartOfTheMatter;
```

The way we are going to solve this problem is by declaring all of our gestures and animations on the UI thread. So that even if the JavaScript thread is busy all the animations can run at 60fps even on low-end devices and wo we are not going to use the default animated API which relies on communication between the JavaScript thread and the UI thread, but on **Reanimated** and **React Native Gesture Handler**, which are dedicated on building declarative gestures and animations.

```js
```