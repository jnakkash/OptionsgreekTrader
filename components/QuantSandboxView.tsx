import React, { useState, useEffect, useRef } from 'react';
import { Play, Loader2, Code2, Terminal, Info, ChevronDown, ChevronUp, Sparkles, Image as ImageIcon, Save, BookmarkCheck, FileText, FileSpreadsheet, FileCode, Printer } from 'lucide-react';
import { generateQuantCode } from '../services/gemini';
import { useAuth } from '../FirebaseProvider';
import { saveRunToDatabase } from '../services/historyService';
import { exportAsJSON, exportAsTextReport, exportAsCSV, printDocument } from '../services/exportUtils';

declare global {
  interface Window {
    loadPyodide: any;
    displayPlot: (base64: string) => void;
  }
}

export const QuantSandboxView = ({ initialCode }: { initialCode: string }) => {
  const { user } = useAuth();
  const [code, setCode] = useState(initialCode || '# Write your Python Quant script here\nprint("Hello from native Python in the browser!")');
  const [output, setOutput] = useState("Initializing Python environment (downloading Pyodide)...\n");
  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [showInstructions, setShowInstructions] = useState(true);
  const [plots, setPlots] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const pyodideRef = useRef<any>(null);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
    }
  }, [initialCode]);

  useEffect(() => {
    let isMounted = true;
    
    window.displayPlot = (base64: string) => {
      if (isMounted) {
        setPlots(prev => [...prev, base64]);
      }
    };

    const initPyodide = async () => {
      try {
        if (!window.loadPyodide) {
          const script = document.createElement('script');
          script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
          });
        }
        
        if (isMounted && window.loadPyodide && !pyodideRef.current) {
          const pyodide = await window.loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
          });
          if (!isMounted) return;
          
          setOutput(prev => prev + "Loading full quant & data science suite (numpy, scipy, pandas, matplotlib, scikit-learn, statsmodels, sympy, micropip)...\n");
          await pyodide.loadPackage(['numpy', 'scipy', 'pandas', 'matplotlib', 'scikit-learn', 'statsmodels', 'sympy', 'micropip', 'patsy']);
          
          if (!isMounted) return;
          pyodideRef.current = pyodide;
          
          pyodide.setStdout({
            batched: (msg: string) => {
              if (isMounted) setOutput(prev => prev + msg + "\n");
            }
          });
          
          await pyodide.runPythonAsync(`
import matplotlib.pyplot as plt
import io, base64, sys, types
import js

def show_plot():
    buf = io.BytesIO()
    plt.savefig(buf, format='png')
    buf.seek(0)
    img_str = base64.b64encode(buf.read()).decode('utf-8')
    js.window.displayPlot(img_str)
    plt.clf()

plt.show = show_plot

# In-browser TensorFlow.js WebGL / WASM Bridge for Python
tf_js = js.window.tf
import pyodide.ffi

def _py_to_js(val):
    if val is None:
        return None
    if isinstance(val, (int, float, str, bool)):
        return val
    try:
        return pyodide.ffi.to_js(val, dict_converter=js.Object.fromEntries)
    except Exception:
        return val

def _clean_int(val, default=1):
    if val is None:
        return default
    try:
        if isinstance(val, (int, float, str)):
            ival = int(float(val))
            return ival if ival > 0 else default
        if hasattr(val, 'item'):
            ival = int(val.item())
            return ival if ival > 0 else default
        ival = int(val)
        return ival if ival > 0 else default
    except Exception:
        return default

def _clean_shape(shape):
    if shape is None:
        return None
    if isinstance(shape, (int, float)):
        return [int(shape)]
    if hasattr(shape, 'item'):
        return [int(shape.item())]
    if isinstance(shape, (list, tuple)):
        cleaned = []
        for x in shape:
            if x is None:
                continue
            if isinstance(x, (int, float)):
                cleaned.append(int(x))
            elif hasattr(x, 'item'):
                cleaned.append(int(x.item()))
            else:
                try:
                    cleaned.append(int(x))
                except Exception:
                    pass
        return cleaned if cleaned else None
    return None

class NNLayersBridge:
    def __init__(self, js_tf):
        self._js_tf = js_tf
    def relu(self, x):
        return self._js_tf.relu(x)
    def sigmoid(self, x):
        return self._js_tf.sigmoid(x)
    def softmax(self, x, axis=-1):
        return self._js_tf.softmax(x, axis)
    def tanh(self, x):
        return self._js_tf.tanh(x)
    def leaky_relu(self, x, alpha=0.2):
        return self._js_tf.leakyRelu(x, alpha)

class RandomBridge:
    def __init__(self, js_tf):
        self._js_tf = js_tf
    def normal(self, shape, mean=0.0, stddev=1.0, dtype=None):
        return self._js_tf.randomNormal(_py_to_js(_clean_shape(shape) or shape), mean, stddev)
    def uniform(self, shape, minval=0.0, maxval=1.0, dtype=None):
        return self._js_tf.randomUniform(_py_to_js(_clean_shape(shape) or shape), minval, maxval)

class LossesBridge:
    def __init__(self, js_tf):
        self._js_tf = js_tf
    def mse(self, y_true, y_pred):
        return self._js_tf.losses.meanSquaredError(y_true, y_pred)
    def mean_squared_error(self, y_true, y_pred):
        return self._js_tf.losses.meanSquaredError(y_true, y_pred)
    def mae(self, y_true, y_pred):
        return self._js_tf.losses.absoluteDifference(y_true, y_pred)
    def mean_absolute_error(self, y_true, y_pred):
        return self._js_tf.losses.absoluteDifference(y_true, y_pred)
    def binary_crossentropy(self, y_true, y_pred):
        return self._js_tf.losses.sigmoidCrossEntropy(y_true, y_pred)
    def categorical_crossentropy(self, y_true, y_pred):
        return self._js_tf.losses.softmaxCrossEntropy(y_true, y_pred)
    def MeanSquaredError(self):
        return lambda y_t, y_p: self.mse(y_t, y_p)
    def BinaryCrossentropy(self):
        return lambda y_t, y_p: self.binary_crossentropy(y_t, y_p)
    def CategoricalCrossentropy(self):
        return lambda y_t, y_p: self.categorical_crossentropy(y_t, y_p)

class TFBridge:
    def __init__(self, js_tf):
        self._js_tf = js_tf
        self.version = "2.16.0-tfjs-webgl"
        self.__version__ = "2.16.0-tfjs-webgl"
        self.__name__ = "tensorflow"
        self.nn = NNLayersBridge(js_tf)
        self.random = RandomBridge(js_tf)
        self.losses = LossesBridge(js_tf)
        self.metrics = LossesBridge(js_tf)
        
    def tensor(self, data, shape=None, dtype=None):
        shp = _clean_shape(shape) if shape else None
        if hasattr(data, 'tolist'):
            return self._js_tf.tensor(data.tolist(), _py_to_js(shp) if shp else None, dtype)
        return self._js_tf.tensor(data, _py_to_js(shp) if shp else None, dtype)
        
    def constant(self, value, dtype=None, shape=None):
        shp = _clean_shape(shape) if shape else None
        if hasattr(value, 'tolist'):
            return self._js_tf.tensor(value.tolist(), _py_to_js(shp) if shp else None, dtype)
        return self._js_tf.tensor(value, _py_to_js(shp) if shp else None, dtype)
        
    def Variable(self, initial_value, dtype=None, name=None):
        t = self.tensor(initial_value, dtype=dtype)
        return self._js_tf.variable(t)
        
    def matmul(self, a, b):
        return self._js_tf.matMul(a, b)
        
    def add(self, a, b):
        return self._js_tf.add(a, b)

    def sub(self, a, b):
        return self._js_tf.sub(a, b)

    def subtract(self, a, b):
        return self._js_tf.sub(a, b)

    def multiply(self, a, b):
        return self._js_tf.mul(a, b)

    def mul(self, a, b):
        return self._js_tf.mul(a, b)

    def divide(self, a, b):
        return self._js_tf.div(a, b)

    def div(self, a, b):
        return self._js_tf.div(a, b)

    def square(self, x):
        return self._js_tf.square(x)

    def sqrt(self, x):
        return self._js_tf.sqrt(x)

    def exp(self, x):
        return self._js_tf.exp(x)

    def log(self, x):
        return self._js_tf.log(x)

    def abs(self, x):
        return self._js_tf.abs(x)

    def reduce_mean(self, x, axis=None, keepdims=False):
        return self._js_tf.mean(x, axis, keepdims)

    def reduce_sum(self, x, axis=None, keepdims=False):
        return self._js_tf.sum(x, axis, keepdims)

    def reduce_max(self, x, axis=None, keepdims=False):
        return self._js_tf.max(x, axis, keepdims)

    def reduce_min(self, x, axis=None, keepdims=False):
        return self._js_tf.min(x, axis, keepdims)

    def zeros(self, shape, dtype=None):
        return self._js_tf.zeros(_py_to_js(_clean_shape(shape) or [int(shape)]), dtype)

    def ones(self, shape, dtype=None):
        return self._js_tf.ones(_py_to_js(_clean_shape(shape) or [int(shape)]), dtype)

    def cast(self, x, dtype):
        return self._js_tf.cast(x, dtype)

    def reshape(self, x, shape):
        return self._js_tf.reshape(x, _py_to_js(_clean_shape(shape) or [int(shape)]))

    def concat(self, tensors, axis=0):
        return self._js_tf.concat(_py_to_js(tensors), axis)

    def stack(self, tensors, axis=0):
        return self._js_tf.stack(_py_to_js(tensors), axis)

    @property
    def keras(self):
        return KerasBridge(self._js_tf)

class KerasBridge:
    def __init__(self, js_tf):
        self._js_tf = js_tf
        self.models = KerasModelsBridge(js_tf)
        self.layers = KerasLayersBridge(js_tf)
        self.optimizers = KerasOptimizersBridge(js_tf)
        self.losses = LossesBridge(js_tf)
        self.metrics = LossesBridge(js_tf)

class KerasModelWrapper:
    def __init__(self, js_model, js_tf):
        self._js_model = js_model
        self._js_tf = js_tf
        self.history = None

    def add(self, layer):
        self._js_model.add(layer)
        return self

    def pop(self):
        return self._js_model.pop()

    @property
    def layers(self):
        try:
            return list(self._js_model.layers)
        except Exception:
            return []

    def compile(self, optimizer='adam', loss='mse', metrics=None, **kwargs):
        loss_map = {
            'mse': 'meanSquaredError',
            'mean_squared_error': 'meanSquaredError',
            'mae': 'meanAbsoluteError',
            'mean_absolute_error': 'meanAbsoluteError',
            'binary_crossentropy': 'binaryCrossentropy',
            'categorical_crossentropy': 'categoricalCrossentropy',
            'sparse_categorical_crossentropy': 'sparseCategoricalCrossentropy',
            'huber': 'huberLoss',
            'huber_loss': 'huberLoss'
        }
        
        opt = optimizer
        if isinstance(optimizer, str):
            opt_str = optimizer.lower()
            if opt_str == 'adam':
                opt = self._js_tf.train.adam(0.001)
            elif opt_str == 'sgd':
                opt = self._js_tf.train.sgd(0.01)
            elif opt_str == 'rmsprop':
                opt = self._js_tf.train.rmsprop(0.001)
            elif opt_str == 'adagrad':
                opt = self._js_tf.train.adagrad(0.01)
            elif opt_str == 'adamax':
                opt = self._js_tf.train.adamax(0.002)

        resolved_loss = loss_map.get(str(loss).lower(), loss) if isinstance(loss, str) else loss
        
        compile_config = {'optimizer': opt, 'loss': resolved_loss}
        if metrics:
            compile_config['metrics'] = list(metrics) if isinstance(metrics, (list, tuple)) else [metrics]
            
        self._js_model.compile(_py_to_js(compile_config))

    def _to_tensor(self, data):
        if hasattr(data, 'tolist'):
            return self._js_tf.tensor(data.tolist())
        elif isinstance(data, (list, tuple, np.ndarray)):
            return self._js_tf.tensor(data)
        return data

    def train_on_batch(self, x, y):
        tensor_x = self._to_tensor(x)
        tensor_y = self._to_tensor(y)
        loss = self._js_model.trainOnBatch(tensor_x, tensor_y)
        try:
            if hasattr(loss, 'arraySync'):
                return float(loss.arraySync())
            elif isinstance(loss, (int, float)):
                return float(loss)
            elif hasattr(loss, '__iter__'):
                return [float(v) for v in loss]
        except Exception:
            pass
        return float(loss) if isinstance(loss, (int, float)) else 0.0

    def fit(self, x, y, epochs=10, batch_size=32, verbose=1, **kwargs):
        tensor_x = self._to_tensor(x)
        tensor_y = self._to_tensor(y)
        num_epochs = _clean_int(epochs, default=10)
        bs = _clean_int(batch_size, default=32)
        
        try:
            n_samples = len(x) if hasattr(x, '__len__') else int(tensor_x.shape[0])
        except Exception:
            n_samples = 32

        history_loss = []
        for ep in range(num_epochs):
            ep_losses = []
            for i in range(0, n_samples, bs):
                batch_x = x[i:i+bs] if hasattr(x, '__getitem__') else tensor_x.slice([i, 0], [min(bs, n_samples - i), -1])
                batch_y = y[i:i+bs] if hasattr(y, '__getitem__') else tensor_y.slice([i], [min(bs, n_samples - i)])
                l = self.train_on_batch(batch_x, batch_y)
                val = l if isinstance(l, (int, float)) else (l[0] if isinstance(l, (list, tuple)) and len(l) > 0 else 0.0)
                ep_losses.append(val)
            mean_loss = float(np.mean(ep_losses)) if ep_losses else 0.0
            history_loss.append(mean_loss)
            if verbose and ((ep + 1) % max(1, num_epochs // 5) == 0 or ep == num_epochs - 1):
                print("Epoch %d/%d - loss: %.6f" % (ep + 1, num_epochs, mean_loss))
        
        class History:
            def __init__(self, losses):
                self.history = {'loss': losses}
        self.history = History(history_loss)
        return self.history

    def evaluate(self, x, y, batch_size=None, verbose=0, **kwargs):
        tensor_x = self._to_tensor(x)
        tensor_y = self._to_tensor(y)
        res = self._js_model.evaluate(tensor_x, tensor_y)
        try:
            if hasattr(res, 'arraySync'):
                return float(res.arraySync())
            elif isinstance(res, (int, float)):
                return float(res)
            elif hasattr(res, '__iter__'):
                return [float(v) for v in res]
        except Exception:
            pass
        return 0.0

    def predict(self, x, batch_size=None, verbose=0, **kwargs):
        tensor_x = self._to_tensor(x)
        pred_tensor = self._js_model.predict(tensor_x)
        arr = pred_tensor.arraySync()
        return np.array(arr)

    def summary(self, line_length=None, positions=None, print_fn=None):
        out = []
        out.append('Model: "sequential"')
        out.append("_________________________________________________________________")
        out.append("%-28s %-24s %-10s" % ("Layer (type)", "Output Shape", "Param #"))
        out.append("=================================================================")
        total_params = 0
        try:
            for l in self._js_model.layers:
                name = str(getattr(l, 'name', 'layer'))
                l_type = str(getattr(l, 'className', 'Dense'))
                shape_str = "multiple"
                try:
                    out_shape = l.outputShape
                    shape_str = str(list(out_shape)) if out_shape else "multiple"
                except Exception:
                    pass
                params = 0
                try:
                    params = l.countParams()
                except Exception:
                    pass
                total_params += params
                layer_desc = name + " (" + l_type + ")"
                out.append("%-28s %-24s %-10s" % (layer_desc, shape_str, str(params)))
        except Exception:
            pass
        out.append("=================================================================")
        out.append("Total params: %s" % str(total_params))
        out.append("_________________________________________________________________")
        s = chr(10).join(out)
        if print_fn:
            print_fn(s)
        else:
            print(s)

    def __call__(self, x):
        return self.predict(x)

class KerasModelsBridge:
    def __init__(self, js_tf):
        self._js_tf = js_tf
    def Sequential(self, layers=None):
        seq = self._js_tf.sequential()
        wrapper = KerasModelWrapper(seq, self._js_tf)
        if layers:
            for l in layers:
                wrapper.add(l)
        return wrapper
    def Model(self, inputs=None, outputs=None, **kwargs):
        if inputs is not None and outputs is not None:
            m = self._js_tf.model(_py_to_js({'inputs': inputs, 'outputs': outputs}))
            return KerasModelWrapper(m, self._js_tf)
        seq = self._js_tf.sequential()
        return KerasModelWrapper(seq, self._js_tf)

class KerasLayersBridge:
    def __init__(self, js_tf):
        self._js_tf = js_tf

    def Dense(self, units=32, activation='linear', input_shape=None, input_dim=None, use_bias=True, **kwargs):
        target_units = kwargs.pop('units') if 'units' in kwargs else units
        if target_units is None or (isinstance(target_units, str) and not target_units.isdigit() and target_units in ['linear', 'relu', 'sigmoid', 'tanh', 'softmax']):
            target_units = 32
        validated_units = _clean_int(target_units, default=32)
        
        config = {
            'units': validated_units, 
            'activation': str(activation) if activation else 'linear',
            'useBias': bool(use_bias)
        }
        
        raw_shape = input_shape if input_shape is not None else kwargs.get('input_shape', kwargs.get('inputShape'))
        raw_dim = input_dim if input_dim is not None else kwargs.get('input_dim', kwargs.get('inputDim'))
        raw_batch_shape = kwargs.get('batch_input_shape', kwargs.get('batchInputShape'))
        
        if raw_shape is not None:
            parsed_shape = _clean_shape(raw_shape)
            if parsed_shape:
                config['inputShape'] = parsed_shape
        elif raw_dim is not None:
            parsed_dim = _clean_int(raw_dim, default=1)
            config['inputShape'] = [parsed_dim]
        elif raw_batch_shape is not None:
            parsed_batch_shape = _clean_shape(raw_batch_shape)
            if parsed_batch_shape:
                config['batchInputShape'] = parsed_batch_shape
                
        return self._js_tf.layers.dense(_py_to_js(config))

    def Dropout(self, rate=0.1, **kwargs):
        r = float(rate) if rate is not None else 0.1
        return self._js_tf.layers.dropout(_py_to_js({'rate': max(0.0, min(1.0, r))}))

    def LSTM(self, units=32, activation='tanh', recurrent_activation='sigmoid', use_bias=True, return_sequences=False, return_state=False, go_backwards=False, input_shape=None, **kwargs):
        target_units = kwargs.pop('units') if 'units' in kwargs else units
        validated_units = _clean_int(target_units, default=32)
        config = {
            'units': validated_units, 
            'activation': str(activation) if activation else 'tanh',
            'recurrentActivation': str(recurrent_activation) if recurrent_activation else 'sigmoid',
            'useBias': bool(use_bias),
            'returnSequences': bool(return_sequences),
            'returnState': bool(return_state),
            'goBackwards': bool(go_backwards)
        }
        raw_shape = input_shape if input_shape is not None else kwargs.get('input_shape', kwargs.get('inputShape'))
        if raw_shape is not None:
            parsed_shape = _clean_shape(raw_shape)
            if parsed_shape:
                config['inputShape'] = parsed_shape
        return self._js_tf.layers.lstm(_py_to_js(config))

    def GRU(self, units=32, activation='tanh', return_sequences=False, input_shape=None, **kwargs):
        target_units = kwargs.pop('units') if 'units' in kwargs else units
        validated_units = _clean_int(target_units, default=32)
        config = {
            'units': validated_units, 
            'activation': str(activation) if activation else 'tanh',
            'returnSequences': bool(return_sequences)
        }
        raw_shape = input_shape if input_shape is not None else kwargs.get('input_shape', kwargs.get('inputShape'))
        if raw_shape is not None:
            parsed_shape = _clean_shape(raw_shape)
            if parsed_shape:
                config['inputShape'] = parsed_shape
        return self._js_tf.layers.gru(_py_to_js(config))

    def SimpleRNN(self, units=32, activation='tanh', return_sequences=False, input_shape=None, **kwargs):
        target_units = kwargs.pop('units') if 'units' in kwargs else units
        validated_units = _clean_int(target_units, default=32)
        config = {
            'units': validated_units, 
            'activation': str(activation) if activation else 'tanh',
            'returnSequences': bool(return_sequences)
        }
        raw_shape = input_shape if input_shape is not None else kwargs.get('input_shape', kwargs.get('inputShape'))
        if raw_shape is not None:
            parsed_shape = _clean_shape(raw_shape)
            if parsed_shape:
                config['inputShape'] = parsed_shape
        return self._js_tf.layers.simpleRNN(_py_to_js(config))

    def Conv1D(self, filters=16, kernel_size=3, strides=1, padding='valid', activation='linear', input_shape=None, **kwargs):
        f = _clean_int(filters, default=16)
        ks = _clean_int(kernel_size, default=3)
        config = {
            'filters': f,
            'kernelSize': ks,
            'strides': _clean_int(strides, default=1),
            'padding': str(padding),
            'activation': str(activation) if activation else 'linear'
        }
        raw_shape = input_shape if input_shape is not None else kwargs.get('input_shape', kwargs.get('inputShape'))
        if raw_shape is not None:
            parsed_shape = _clean_shape(raw_shape)
            if parsed_shape:
                config['inputShape'] = parsed_shape
        return self._js_tf.layers.conv1d(_py_to_js(config))

    def Conv2D(self, filters=16, kernel_size=(3, 3), strides=(1, 1), padding='valid', activation='linear', input_shape=None, **kwargs):
        f = _clean_int(filters, default=16)
        ks = _clean_shape(kernel_size) or [3, 3]
        st = _clean_shape(strides) or [1, 1]
        config = {
            'filters': f,
            'kernelSize': ks,
            'strides': st,
            'padding': str(padding),
            'activation': str(activation) if activation else 'linear'
        }
        raw_shape = input_shape if input_shape is not None else kwargs.get('input_shape', kwargs.get('inputShape'))
        if raw_shape is not None:
            parsed_shape = _clean_shape(raw_shape)
            if parsed_shape:
                config['inputShape'] = parsed_shape
        return self._js_tf.layers.conv2d(_py_to_js(config))

    def MaxPooling1D(self, pool_size=2, strides=None, padding='valid', **kwargs):
        config = {'poolSize': _clean_int(pool_size, default=2), 'padding': str(padding)}
        if strides is not None:
            config['strides'] = _clean_int(strides, default=1)
        return self._js_tf.layers.maxPooling1d(_py_to_js(config))

    def Flatten(self, **kwargs):
        return self._js_tf.layers.flatten(_py_to_js({}))

    def BatchNormalization(self, axis=-1, momentum=0.99, epsilon=0.001, **kwargs):
        return self._js_tf.layers.batchNormalization(_py_to_js({'axis': int(axis), 'momentum': float(momentum), 'epsilon': float(epsilon)}))

    def Activation(self, activation='linear', **kwargs):
        return self._js_tf.layers.activation(_py_to_js({'activation': str(activation)}))

    def LeakyReLU(self, alpha=0.3, **kwargs):
        return self._js_tf.layers.leakyReLU(_py_to_js({'alpha': float(alpha)}))

    def ELU(self, alpha=1.0, **kwargs):
        return self._js_tf.layers.elu(_py_to_js({'alpha': float(alpha)}))

    def ReLU(self, max_value=None, negative_slope=0.0, threshold=0.0, **kwargs):
        config = {'negativeSlope': float(negative_slope), 'threshold': float(threshold)}
        if max_value is not None:
            config['maxValue'] = float(max_value)
        return self._js_tf.layers.reLU(_py_to_js(config))

    def Input(self, shape=None, batch_shape=None, dtype='float32', **kwargs):
        config = {}
        if shape is not None:
            config['shape'] = _clean_shape(shape)
        if batch_shape is not None:
            config['batchShape'] = _clean_shape(batch_shape)
        return self._js_tf.layers.input(_py_to_js(config))

    def Bidirectional(self, layer, **kwargs):
        return self._js_tf.layers.bidirectional(_py_to_js({'layer': layer}))

class KerasOptimizersBridge:
    def __init__(self, js_tf):
        self._js_tf = js_tf
    def Adam(self, learning_rate=0.001, beta_1=0.9, beta_2=0.999, epsilon=1e-7, **kwargs):
        return self._js_tf.train.adam(float(learning_rate), float(beta_1), float(beta_2), float(epsilon))
    def SGD(self, learning_rate=0.01, momentum=0.0, **kwargs):
        return self._js_tf.train.sgd(float(learning_rate))
    def RMSprop(self, learning_rate=0.001, decay=0.9, momentum=0.0, epsilon=1e-7, **kwargs):
        return self._js_tf.train.rmsprop(float(learning_rate), float(decay), float(momentum), float(epsilon))
    def Adagrad(self, learning_rate=0.01, **kwargs):
        return self._js_tf.train.adagrad(float(learning_rate))
    def Adamax(self, learning_rate=0.002, **kwargs):
        return self._js_tf.train.adamax(float(learning_rate))

if tf_js:
    tf_instance = TFBridge(tf_js)
    sys.modules['tensorflow'] = tf_instance
    sys.modules['tensorflow.keras'] = tf_instance.keras
    sys.modules['tensorflow.keras.models'] = tf_instance.keras.models
    sys.modules['tensorflow.keras.layers'] = tf_instance.keras.layers
    sys.modules['tensorflow.keras.optimizers'] = tf_instance.keras.optimizers
    sys.modules['tensorflow.keras.losses'] = tf_instance.losses
    sys.modules['tensorflow.keras.metrics'] = tf_instance.metrics
    sys.modules['tensorflow.nn'] = tf_instance.nn
    sys.modules['tensorflow.random'] = tf_instance.random
    sys.modules['tensorflow.losses'] = tf_instance.losses
    sys.modules['torch'] = tf_instance

# Patch pyodide.http.pyfetch to bypass CORS restrictions & strip unsafe headers
import pyodide.http
_orig_pyfetch = pyodide.http.pyfetch

async def _smart_pyfetch(url, **kwargs):
    u = str(url)
    if 'headers' in kwargs and kwargs['headers']:
        if isinstance(kwargs['headers'], dict):
            # Strip unsafe headers that browser fetch forbids or triggers preflight CORS blocks
            hdrs = {k: v for k, v in kwargs['headers'].items() if k.lower() not in ['user-agent', 'host', 'origin', 'referer']}
            kwargs['headers'] = hdrs

    if ("finance.yahoo.com" in u or "query1.finance.yahoo.com" in u or "query2.finance.yahoo.com" in u) and not u.startswith("https://corsproxy.io/?"):
        u = "https://corsproxy.io/?" + u

    try:
        return await _orig_pyfetch(u, **kwargs)
    except Exception as e:
        if "corsproxy.io" not in u:
            proxy_u = "https://corsproxy.io/?" + str(url)
            return await _orig_pyfetch(proxy_u, **kwargs)
        raise e

pyodide.http.pyfetch = _smart_pyfetch

# Built-in high performance yfinance drop-in module
import types, json, js, pandas as pd, numpy as np

def _yf_fetch(url):
    u = str(url)
    if not u.startswith("https://corsproxy.io/?"):
        u = "https://corsproxy.io/?" + u
    try:
        xhr = js.XMLHttpRequest.new()
        xhr.open("GET", u, False)
        xhr.send(None)
        if xhr.status == 200:
            return json.loads(xhr.responseText)
    except Exception:
        pass
    return None

def _fetch_yahoo_df(ticker, period="1y", interval="1d", start=None, end=None):
    ticker = str(ticker).strip().upper()
    range_param = period if period else "2y"
    if start or end:
        range_param = "5y"
    
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range={range_param}&interval={interval}"
    data = _yf_fetch(url)
    if not data or 'chart' not in data or not data['chart'].get('result'):
        return pd.DataFrame(columns=['Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume'])
    
    result = data['chart']['result'][0]
    timestamps = result.get('timestamp', [])
    if not timestamps:
        return pd.DataFrame(columns=['Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume'])
        
    quote = result.get('indicators', {}).get('quote', [{}])[0]
    adjclose_list = result.get('indicators', {}).get('adjclose', [{}])[0].get('adjclose', quote.get('close', []))
    
    opens = quote.get('open', [])
    highs = quote.get('high', [])
    lows = quote.get('low', [])
    closes = quote.get('close', [])
    volumes = quote.get('volume', [])
    
    df = pd.DataFrame({
        'Open': opens,
        'High': highs,
        'Low': lows,
        'Close': closes,
        'Adj Close': adjclose_list if adjclose_list else closes,
        'Volume': volumes
    }, index=pd.to_datetime(timestamps, unit='s'))
    df.index.name = 'Date'
    df = df.dropna(subset=['Close'])
    
    if start:
        df = df[df.index >= pd.to_datetime(start)]
    if end:
        df = df[df.index <= pd.to_datetime(end)]
        
    return df

class _Ticker:
    def __init__(self, ticker):
        self.ticker = str(ticker).strip().upper()
        self._info = None
        
    def history(self, period="1y", interval="1d", start=None, end=None, **kwargs):
        return _fetch_yahoo_df(self.ticker, period=period, interval=interval, start=start, end=end)
        
    @property
    def info(self):
        if self._info is None:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{self.ticker}?range=1d&interval=1d"
            data = _yf_fetch(url)
            meta = {}
            if data and 'chart' in data and data['chart'].get('result'):
                meta = data['chart']['result'][0].get('meta', {})
            self._info = {
                'symbol': self.ticker,
                'regularMarketPrice': meta.get('regularMarketPrice', 0.0),
                'previousClose': meta.get('chartPreviousClose', 0.0),
                'currency': meta.get('currency', 'USD'),
                'exchangeName': meta.get('exchangeName', ''),
                'instrumentType': meta.get('instrumentType', 'EQUITY'),
                'shortName': self.ticker
            }
        return self._info

def _download(tickers, period="1y", interval="1d", start=None, end=None, **kwargs):
    if isinstance(tickers, str):
        t_list = tickers.split()
        if len(t_list) == 1:
            return _fetch_yahoo_df(t_list[0], period=period, interval=interval, start=start, end=end)
        dfs = {t: _fetch_yahoo_df(t, period=period, interval=interval, start=start, end=end) for t in t_list}
        return pd.concat(dfs, axis=1)
    elif isinstance(tickers, (list, tuple)):
        if len(tickers) == 1:
            return _fetch_yahoo_df(tickers[0], period=period, interval=interval, start=start, end=end)
        dfs = {t: _fetch_yahoo_df(t, period=period, interval=interval, start=start, end=end) for t in tickers}
        return pd.concat(dfs, axis=1)
    return pd.DataFrame()

yf_mod = types.ModuleType('yfinance')
yf_mod.Ticker = _Ticker
yf_mod.download = _download
yf_mod._fetch_yahoo_df = _fetch_yahoo_df
sys.modules['yfinance'] = yf_mod

import micropip
try:
    await micropip.install('pyodide-http')
    import pyodide_http
    pyodide_http.patch_all()
except Exception:
    pass
          `);
          
          setOutput(prev => prev + "Python environment ready! Native libraries (pandas, numpy, scipy, scikit-learn, statsmodels, tensorflow [tfjs WebGL], matplotlib, sympy, yfinance) pre-loaded and active.\n\n");
          setIsReady(true);
        }
      } catch (err: any) {
        if (isMounted) setOutput(prev => prev + "\nFailed to load Python environment: " + err.message + "\n");
      }
    };
    
    initPyodide();
    return () => { isMounted = false; };
  }, []);

  const runCode = async () => {
    if (!pyodideRef.current) return;
    setIsRunning(true);
    setPlots([]);
    setSaved(false);
    setOutput(prev => prev + "> Auto-loading dependencies & running script...\n");
    try {
      // Auto-load any built-in Pyodide imported packages
      if (typeof pyodideRef.current.loadPackagesFromImports === 'function') {
        await pyodideRef.current.loadPackagesFromImports(code);
      } else if (typeof (pyodideRef.current as any).loadImports === 'function') {
        await (pyodideRef.current as any).loadImports(code);
      }

      // Auto-install pure Python PyPI dependencies (such as yfinance, ta, quantstats) via micropip
      await pyodideRef.current.runPythonAsync(`
import ast, sys, micropip

code_text = ${JSON.stringify(code)}
try:
    tree = ast.parse(code_text)
    imports_to_check = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports_to_check.add(alias.name.split('.')[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports_to_check.add(node.module.split('.')[0])
    
    for mod in imports_to_check:
        if mod not in sys.modules and mod not in sys.builtin_module_names:
            try:
                print(f"> Auto-installing PyPI package '{mod}' via micropip...")
                await micropip.install(mod)
                print(f"> Package '{mod}' ready.")
            except Exception as e:
                print(f"> Failed to install '{mod}': {e}")
except Exception:
    pass

try:
    import pyodide_http
    pyodide_http.patch_all()
except Exception:
    pass
      `);

      await pyodideRef.current.runPythonAsync(code);
    } catch (err: any) {
      setOutput(prev => prev + err.toString() + "\n");
    } finally {
      setIsRunning(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const generatedCode = await generateQuantCode(prompt);
      setCode(generatedCode);
      setPrompt("");
    } catch (error) {
      console.error(error);
      alert("Failed to generate code. See console.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToDb = async () => {
    if (!user) {
      alert("Please sign in to save code runs to your database.");
      return;
    }
    setSaving(true);
    try {
      await saveRunToDatabase(user.uid, {
        ticker: 'QUANT_CODE',
        mode: 'SANDBOX',
        title: 'Python Quant Script Execution',
        result: { code, output }
      });
      setSaved(true);
    } catch (err) {
      console.error(err);
      alert("Failed to save code execution to database.");
    } finally {
      setSaving(false);
    }
  };

  const exportPayload = {
    ticker: 'QUANT_CODE',
    mode: 'SANDBOX',
    title: 'Python Quant Script Report',
    result: { code, output }
  };

  return (
    <div className="w-full max-w-5xl mx-auto mt-8 animate-in fade-in pb-12">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Code2 className="text-terminal-accent" /> Quant Sandbox
          </h2>
          <p className="text-gray-400 mt-1">Run Python data science & quant scripts natively in your browser using Pyodide WebAssembly.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={runCode}
            disabled={!isReady || isRunning}
            className="flex items-center gap-2 bg-terminal-accent text-black font-bold px-6 py-2 rounded shadow-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            Run Script
          </button>
        </div>
      </div>

      {/* Save & Export Toolbar */}
      <div className="bg-[#0f0f0f] border border-gray-800 rounded-xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-gray-400 font-mono flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span>Python Environment Ready</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSaveToDb}
            disabled={saving || saved}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-xs transition-colors ${
              saved 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-terminal-accent text-black hover:bg-white'
            }`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <BookmarkCheck size={14} /> : <Save size={14} />}
            {saved ? "Saved to History" : "Save to Database"}
          </button>

          <span className="text-gray-700">|</span>

          <button 
            onClick={() => exportAsTextReport(exportPayload)}
            className="flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-gray-800 border border-gray-800 text-xs text-gray-300 rounded-lg transition-colors"
            title="Export Text Report"
          >
            <FileText size={14} className="text-blue-400" /> Report (.txt)
          </button>

          <button 
            onClick={() => exportAsCSV(exportPayload)}
            className="flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-gray-800 border border-gray-800 text-xs text-gray-300 rounded-lg transition-colors"
            title="Export CSV Table"
          >
            <FileSpreadsheet size={14} className="text-green-400" /> CSV
          </button>

          <button 
            onClick={() => exportAsJSON(exportPayload)}
            className="flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-gray-800 border border-gray-800 text-xs text-gray-300 rounded-lg transition-colors"
            title="Export JSON"
          >
            <FileCode size={14} className="text-yellow-400" /> JSON
          </button>

          <button 
            onClick={() => printDocument(exportPayload)}
            className="flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-gray-800 border border-gray-800 text-xs text-gray-300 rounded-lg transition-colors"
            title="Print / Save PDF"
          >
            <Printer size={14} className="text-purple-400" /> Print / PDF
          </button>
        </div>
      </div>

      <div className="bg-[#111] border border-gray-800 rounded-lg overflow-hidden mb-6">
        <button 
          onClick={() => setShowInstructions(!showInstructions)}
          className="w-full flex items-center justify-between p-4 bg-black/50 hover:bg-gray-900 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Info size={18} className="text-terminal-accent" />
            <span className="font-bold text-sm text-gray-300">How to use the Quant Sandbox</span>
          </div>
          {showInstructions ? <ChevronUp size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
        </button>
        
        {showInstructions && (
          <div className="p-4 border-t border-gray-800 text-sm text-gray-400 leading-relaxed">
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Native Execution:</strong> This sandbox runs real Python 3 directly in your browser using Pyodide (WebAssembly). No server-side execution is needed.</li>
              <li><strong>Pre-loaded Packages:</strong> Core data science libraries including <code>numpy</code>, <code>scipy</code>, <code>pandas</code>, and <code>matplotlib</code> are already loaded and ready to import.</li>
              <li><strong>Running Code:</strong> Type your Python script in the Editor on the left and click <strong>Run Script</strong>. All <code>print()</code> statements and errors will appear in the Output terminal on the right.</li>
              <li><strong>Plotting:</strong> Any charts generated using <code>matplotlib.pyplot.show()</code> will be rendered automatically below the editor!</li>
            </ul>
          </div>
        )}
      </div>

      {/* AI Strategy Generator */}
      <div className="mb-6 bg-gradient-to-r from-terminal-accent/10 to-transparent border border-terminal-accent/30 rounded-lg p-4">
        <h3 className="text-sm font-bold flex items-center gap-2 text-white mb-2">
          <Sparkles size={16} className="text-terminal-accent" /> AI Strategy Generator
        </h3>
        <p className="text-xs text-gray-400 mb-4">Describe a trading strategy and AI will write the Python code to test it and generate plots.</p>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="e.g., 'Generate a Python script to backtest a moving average crossover strategy on random data and plot the results'"
            className="flex-1 bg-black/50 border border-gray-700 text-white px-4 py-2 rounded text-sm focus:outline-none focus:border-terminal-accent"
            onKeyDown={e => {
              if (e.key === 'Enter') handleGenerate();
            }}
          />
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="bg-terminal-accent text-black px-6 py-2 rounded text-sm font-bold hover:bg-white transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Generate
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor */}
        <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg overflow-hidden flex flex-col h-[500px]">
          <div className="bg-black border-b border-gray-800 px-4 py-2 flex items-center gap-2">
            <Terminal size={14} className="text-gray-500" />
            <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Editor (Python)</span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 w-full bg-transparent text-gray-300 font-mono text-sm p-4 outline-none resize-none custom-scrollbar"
            spellCheck="false"
          />
        </div>

        {/* Output */}
        <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg overflow-hidden flex flex-col h-[500px]">
          <div className="bg-black border-b border-gray-800 px-4 py-2 flex items-center gap-2">
            <Code2 size={14} className="text-gray-500" />
            <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Output (Stdout)</span>
          </div>
          <pre className="flex-1 w-full bg-transparent text-terminal-accent font-mono text-sm p-4 overflow-y-auto whitespace-pre-wrap custom-scrollbar">
            {output}
          </pre>
        </div>
      </div>
      
      {/* Generated Plots */}
      {plots.length > 0 && (
        <div className="mt-6 bg-[#0f0f0f] border border-gray-800 rounded-lg p-6 animate-in fade-in zoom-in-95">
          <h3 className="text-lg font-bold flex items-center gap-2 text-white mb-4">
            <ImageIcon size={20} className="text-terminal-accent" /> Generated Plots
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plots.map((plot, i) => (
              <div key={i} className="bg-white rounded-lg p-2 overflow-hidden shadow-xl border border-gray-700">
                <img src={`data:image/png;base64,${plot}`} alt={`Generated Plot ${i+1}`} className="w-full h-auto object-contain" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
