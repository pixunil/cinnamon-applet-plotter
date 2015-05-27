const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;

const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;
const St = imports.gi.St;

const TweenEquations = imports.tweener.equations;

const math = imports.ui.appletManager.applets["plotter@pixunil"].math;

const AnimationSettingMap = {
    scale: 1,
    x: 2,
    y: 2
};

function bind(func, context){
    function callback(){
        try {
            return func.apply(context, arguments);
        } catch(e){
            global.logError(e);
            return null;
        }
    }

    return callback;
}

function Canvas(){
    this._init.apply(this, arguments);
}

Canvas.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    x: 0,
    y: 0,

    scale: 10,
    textScale: .8,

    _init: function(applet){
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {activate: false, sensitive: false});

        this.canvas = new St.DrawingArea({height: 250});
        this.canvas.connect("repaint", bind(this.draw, this));
        this.addActor(this.canvas, {expand: true, span: -1});

        this.actor.connect("allocation-changed", bind(this.applyTransform, this));
        this.actor.connect("scroll-event", bind(this.onScroll, this));
        this.actor.connect("key-press-event", bind(this.onKeyPress, this));
        this.actor.connect("button-press-event", bind(this.onButtonPress, this));
        this.actor.connect("button-release-event", bind(this.onButtonRelease, this));
        this.actor.connect("motion-event", bind(this.onMotion, this));

        this.applet = applet;
        this.settings = applet.settings;

        this.size = [2, 4, 8];

        this.animation = {
            duration: 500,
            x: [this.x, 0],
            y: [this.y, 0],
            scale: [this.scale, 0]
        };

        this.animation.timeline = new Clutter.Timeline({duration: this.animation.duration});
        this.animation.timeline.connect("new-frame", bind(this.animationFrame, this));
    },

    repaint: function(){
        this.canvas.queue_repaint();
    },

    draw: function(){
        this.ctx = this.canvas.get_context();
        let w = this.canvas.get_width();
        let h = this.canvas.get_height();

        this.ctx.setSourceRGBA(.8, .8, .8, .5);
        this.ctx.setFontSize(1);

        this.ctx.translate(w / 2, h / 2);
        this.ctx.scale(this.scale, -this.scale);
        this.ctx.translate(this.x, this.y);

        this.layout = PangoCairo.create_layout(this.ctx);

        let description = Pango.FontDescription.from_string("Noto Sans 10");
        this.layout.set_font_description(description);

        this.drawAxis();
        this.drawFunctions();
    },

    drawAxis: function(){
        this.ctx.moveTo(this.x1, this.axis.y);
        this.ctx.lineTo(this.x2, this.axis.y);

        this.ctx.moveTo(this.axis.x, this.y1);
        this.ctx.lineTo(this.axis.x, this.y2);

        if(this.axis.x === 0 || this.axis.y === 0)
            this.drawAxisText(0, null, null);

        for(let x = this.axis.tx1; x <= this.axis.tx2; ++x){
            if(x === 0)
                continue;

            let size = this.size[0];
            if(x % 5 === 0){
                size = this.size[1];
                this.drawAxisText(x * this.step[0], x * this.step[0], null);
            }
            if(x % 10 === 0)
                size = this.size[2];

            this.ctx.moveTo(x * this.step[0], this.axis.y - size / this.scale);
            this.ctx.lineTo(x * this.step[0], this.axis.y + size / this.scale);
        }

        for(let y = this.axis.ty1; y <= this.axis.ty2; ++y){
            if(y === 0)
                continue;

            let size = this.size[0];
            if(y % 5 === 0){
                size = this.size[1];
                this.drawAxisText(y * this.step[0], null, y * this.step[0]);
            }
            if(y % 10 === 0)
                size = this.size[2];

            this.ctx.moveTo(this.axis.x - size / this.scale, y * this.step[0]);
            this.ctx.lineTo(this.axis.x + size / this.scale, y * this.step[0]);
        }

        this.ctx.save();
        this.ctx.identityMatrix();
        this.ctx.stroke();
        this.ctx.restore();
    },

    drawAxisText: function(text, x, y){
        this.ctx.save();
        this.ctx.scale(this.textScale / this.scale, this.textScale / this.scale);
        PangoCairo.update_layout(this.ctx, this.layout);

        this.layout.set_text(text + "", -1);
        let size = this.layout.get_extents()[0];

        let width = size.width / Pango.SCALE;
        let height = size.height / Pango.SCALE;

        let scale = this.scale / this.textScale;

        if(x === null){
            x = this.axis.x * scale;
            if(this.x > 0)
                x -= width + this.size[2] / this.textScale;
            else
                x += this.size[2] / this.textScale;
        } else
            x = x * scale - width / 2;

        if(y === null){
            y = this.axis.y * scale;
            if(this.y > 0)
                y -= this.size[2];
            else
                y += this.size[2] + 2 * height;
        } else
            y = y * scale + height;

        this.ctx.moveTo(x, y);
        this.ctx.scale(1, -1);

        PangoCairo.show_layout(this.ctx, this.layout);
        this.ctx.restore();
    },

    drawFunctions: function(){
        this.ctx.setSourceRGB(1, .5, 0);

        let entries = this.applet.entries._getMenuItems();
        for(let i = 0, l = entries.length; i < l; ++i){
            if(entries[i].func)
                this.drawFunction(entries[i].func);
        }
    },

    drawFunction: function(func){
        for(let x = this.x1; x <= this.x2; x += .5 / this.scale){
            let y;
            try {
                y = func(x);
            } catch(e){
                continue;
            }

            this.ctx.lineTo(x, func(x));
        }

        this.ctx.save();
        this.ctx.identityMatrix();
        this.ctx.stroke();
        this.ctx.restore();
    },

    onScroll: function(actor, event){
        let direction = event.get_scroll_direction();
        let scale = 0;
        let currentScale = this.scale + this.animation.scale[1];

        if(direction === Clutter.ScrollDirection.DOWN)
            scale = currentScale / 10;
        else if(direction === Clutter.ScrollDirection.UP)
            scale = currentScale / -10;

        this.transformCanvas({scale: scale});

        return true;
    },

    onKeyPress: function(actor, event){
        let symbol = event.get_key_symbol();

        let x = 0;
        let y = 0;

        if(symbol === Clutter.KEY_Left)
            x = 1;
        else if(symbol === Clutter.KEY_Up)
            y = -1;
        else if(symbol === Clutter.KEY_Right)
            x = -1;
        else if(symbol === Clutter.KEY_Down)
            y = 1;

        if(!x && !y) //nothing happened
            return false;

        x *= 10 / this.scale;
        y *= 10 / this.scale;

        this.transformCanvas({x: x, y: y});

        return true;
    },

    onButtonPress: function(actor, event){
        if(this.dragging) //a drag is active, disallow two at the same time
            return;

        this.dragging = event.get_coords();
    },

    onButtonRelease: function(actor, event){
        delete this.dragging;
    },

    onMotion: function(actor, event){
        if(!this.dragging) //ignore motion events without pressing a mouse button
            return;

        let [x, y] = event.get_coords();
        let dx = (x - this.dragging[0]) / this.scale; //calculate the delta value and scale it
        let dy = (this.dragging[1] - y) / this.scale; //same like dx, but invert y value

        this.transformCanvas({x: dx, y: dy}); //apply the transformation
        this.dragging = [x, y];
    },

    transformCanvas: function(params){
        let needsTimelineReset = false;
        let needsRepaint = false;

        for(let param in params){
            if(!params[param])
                continue;

            if(this.settings.animations & AnimationSettingMap[param]){ //enabled animation
                needsTimelineReset = true;
                this.animation[param][1] += params[param] + this.animation[param][0] - this[param]; //update the delta parameter, add the new, remove that what we already have
                this.animation[param][0] = this[param]; //set the absolute paramter
            } else { //disabled
                needsRepaint = true;
                this[param] += params[param]; //update the normal value immediately
            }
        }

        this.applyTransform();

        if(needsTimelineReset){
            //we need to update the animation parameters
            for(let param in this.animation){
                let value = this.animation[param];
                if(!(value instanceof Array) || params[param] || !(this.settings.animations & AnimationSettingMap[param])) //do nothing for invalid, already handled or unanimated values
                    continue;

                value[1] += value[0] - this[param]; //update the delta parameter, remove that what we already have
                value[0] = this[param]; //set the absolute paramter
            }
            this.animation.timeline.stop();
            this.animation.timeline.start();
        }

        if(needsRepaint)
            this.repaint();
    },

    applyTransform: function(){
        let value = 100 / this.scale;
        let exp = Math.pow(10, Math.floor(Math.log(value) / Math.LN10));
        value /= exp;

        if(value > 5)
            value = 5 * exp;
        else if(value > 2)
            value = 2 * exp;
        else
            value = exp;

        this.step = [
            value / 5,
            value,
            value * 2
        ];

        let w = this.canvas.get_width() / 2;
        let h = this.canvas.get_height() / 2;

        this.x1 = -this.x - w / this.scale;
        this.x2 = -this.x + w / this.scale;

        this.y1 = -this.y - h / this.scale;
        this.y2 = -this.y + h / this.scale;

        this.axis = {
            x: Math.max(this.x1, Math.min(this.x2, 0)), //the x coordinate for the y axis
            y: Math.max(this.y1, Math.min(this.y2, 0)), //the y coordinate for the x axis

            tx1: Math.floor(this.x1 / this.step[0]), //the start x coordinate for the steps
            tx2: Math.ceil(this.x2 / this.step[0]), //the end x coordinate for the steps
            ty1: Math.floor(this.y1 / this.step[0]), //the start y coordinate for the steps
            ty2: Math.ceil(this.y2 / this.step[0]) //the end y coordinate for the steps
        };
    },

    animationFrame: function(timeline, time){
        for(let param in this.animation){
            let value = this.animation[param];
            if(!(value instanceof Array) || !value[1])
                continue;

            if(time < this.animation.duration)
                this[param] = TweenEquations.easeOutExpo(time, this.animation[param][0], this.animation[param][1], this.animation.duration);
            else {
                this[param] = this.animation[param][0] + this.animation[param][1];
                this.animation[param][0] = this[param];
                this.animation[param][1] = 0;
            }
        }

        this.applyTransform();

        this.repaint();
    }
};

function MathEntry(){
    this._init.apply(this, arguments);
}

MathEntry.prototype = {
    _init: function(text){
        this.actor = new St.Entry({text: text});

        this.entryText = this.actor.clutter_text;
    },

    get text(){
        return this.entryText.text;
    },

    set text(text){
        this.entryText.text = text;
    }
};

function MathEntryMenuItem(){
    this._init.apply(this, arguments);
}

MathEntryMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(applet, symbol, text){
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {activate: false});

        this.applet = applet;

        this.symbol = new MathEntry(symbol);
        this.addActor(this.symbol.actor, {expand: true});

        this.symbolEqualLabel = new St.Label;
        this.addActor(this.symbolEqualLabel);

        this.entry = new MathEntry(text);
        this.addActor(this.entry.actor, {expand: true});

        this.resultEqualLabel = new St.Label;
        this.addActor(this.resultEqualLabel);

        this.resultLabel = new St.Label;
        this.addActor(this.resultLabel);

        this.symbol.entryText.connect("text-changed", bind(this.onSymbolChanged, this));
        this.onSymbolChanged();

        this.entry.entryText.connect("text-changed", bind(this.onTextChanged, this));
        this.onTextChanged();
    },

    _onKeyFocusIn: function(){},
    _onKeyFocusOut: function(){},

    onSymbolChanged: function(){
        if(this.symbol.text)
            this.symbolEqualLabel.text = "=";
        else
            this.symbolEqualLabel.text = "";
    },

    onTextChanged: function(){
        let showDot = false;
        this.func = null;

        if(this.entry.text){
            if(this.entry.text.indexOf("x") > -1){
                let text = "return " + this.entry.text + ";";

                try {
                    this.func = Function.constructor.call(null, ["x"], text);
                } catch(e){}

                if(this.func){
                    showDot = true;
                    this.result = "";
                    this.applet.canvas.repaint();
                }
            } else {
                let result;
                try {
                    result = math.calculate(math.parse(this.entry.text));
                } catch(e){}

                if(result){
                    showDot = true;
                    this.result = result;
                }
            }
        }

        this.setShowDot(showDot);
    },

    set result(result){
        if(result !== ""){
            this.resultEqualLabel.text = "=";
            this.resultLabel.text = result + "";
        } else {
            this.resultEqualLabel.text = "";
            this.resultLabel.text = "";
        }
    }
};

function AddMathEntryMenuItem(){
    this._init.apply(this, arguments);
}

AddMathEntryMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(applet){
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {activate: false});

        this.applet = applet;

        this.entry = new MathEntry("");
        this.addActor(this.entry.actor, {span: -1, expand: true});

        this.actor.connect("enter-event", bind(function(){
            this.actor.remove_style_class_name("popup-inactive-menu-item");
        }, this));
        this.actor.connect("leave-event", bind(function(){
            this.actor.add_style_class_name("popup-inactive-menu-item");
        }, this));

        this.entry.actor.hint_text = _("Add function or variable ...");
        this.entry.entryText.connect("key-press-event", bind(this.onKeyPress, this));
    },

    _onKeyFocusIn: function(){},
    _onKeyFocusOut: function(){},

    onKeyPress: function(actor, event){
        let symbol = event.get_key_symbol();
        if(symbol === Clutter.KEY_Return){
            //1: symbol, 2: function bracket, 3: content
            let match = this.entry.text.match(math.regEx.input);

            if(match[3].match(math.regEx.whitespace))
                return false;

            let menuItem = new MathEntryMenuItem(this.applet, match[1], match[3]);
            this.applet.entries.addMenuItem(menuItem);
            this.entry.text = "";

            return true;
        }
        return false;
    },

    getColumnWidths: function(){
        return [];
    }
};

function PlotterApplet(metadata, orientation, panelHeight, instanceId){
    this._init(metadata, orientation, panelHeight, instanceId);
}

PlotterApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId){
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight);

        this.set_applet_icon_symbolic_name("accessories-calculator");

        this.settings = {};
        this.settingProvider = new Settings.AppletSettings(this.settings, metadata.uuid, instanceId);
        this.settingProvider.bindProperty(Settings.BindingDirection.IN, "animations", "animations");

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.canvas = new Canvas(this);
        this.menu.addMenuItem(this.canvas);

        let headerItem = new PopupMenu.PopupBaseMenuItem({reactive: false});
        headerItem.actor.height = 0;
        headerItem.actor.opacity = 0;
        headerItem.addActor(new St.Bin({width: 20}));
        headerItem.addActor(new St.Label({text: "="}));
        headerItem.addActor(new St.Bin({width: 200}));
        headerItem.addActor(new St.Label({text: "="}));
        headerItem.addActor(new St.Bin({width: 40}));
        this.menu.addMenuItem(headerItem);

        this.entries = new PopupMenu.PopupMenuSection;
        this.menu.addMenuItem(this.entries);

        let entryMenuItem = new AddMathEntryMenuItem(this);
        this.menu.addMenuItem(entryMenuItem);
    },

    on_applet_clicked: function(){
        this.menu.toggle();
    },

    on_applet_removed_from_panel: function(){
        this.settingProvider.finalize();
    }
};

function main(metadata, orientation, panelHeight, instanceId){
    return new PlotterApplet(metadata, orientation, panelHeight, instanceId);
}
