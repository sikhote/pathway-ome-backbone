(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
var IntroView = require("./app/views/intro");
var HelloView = require("./app/views/hello");
var ConversationView = require("./app/views/conversation");
var Router = require("./app/router");

module.exports = Backbone.View.extend({
	el: "#app",
	initialize: function() {
		var self = this;
		
		// Start router with predefined routes
		this.router = new Router();
		
		// Route actions
		this.router.on("route:intro", function() {
			var view = new IntroView();
			
			self.goTo(view);
			
			// Listen for end of view
			self.listenToOnce(view, "end", function() {
				self.router.navigate("hello", {trigger: true});
			});
		});
		
		this.router.on("route:hello", function() {
			var view = new HelloView();
			
			self.goTo(view);
			
			// Listen for end of view
			self.listenToOnce(view, "end", function() {
				self.router.navigate("conversation", {trigger: true});
			});
		});
		
		this.router.on("route:conversation", function() {
			var conversationView = new ConversationView();
			
			self.goTo(conversationView);
		});
		
		// Start tracking
		Backbone.history.start({pushState: true});
	},
	events: {
		"click .refresh": "refresh"
	},
	refresh: function() {
		window.location.replace("/");
	},
	goTo: function(view) {
		var self = this;
		var previous = this.currentView || null;
		var next = view;
		
		// Hide the current view
		if(previous) {
			TweenMax.to(previous.$el, .5, {
				opacity: 0,
				onComplete: function() {previous.remove();}
			});
		}
		
		// Add , hide, and wait until loaded
		self.currentView = next;
		self.$el.append(next.el);
		next.$el.hide();
		
		self.listenToOnce(next, "loaded", function() {
			// Wait for images and reveal
			next.$el.waitForImages(function() {
				self.$el.removeClass("spinner").addClass("spinOut");
				next.$el.show();
				TweenMax.from(next.$el, .5, {opacity: 0});
			});
		});
	},
});
},{"./app/router":6,"./app/views/conversation":7,"./app/views/hello":14,"./app/views/intro":15}],2:[function(require,module,exports){
"use strict";
var PersonModel = require("../models/person");

module.exports = Backbone.Collection.extend({
	model: PersonModel
});
},{"../models/person":4}],3:[function(require,module,exports){
"use strict";
var QuestionModel = require("../models/question");

module.exports = Backbone.Collection.extend({
	model: QuestionModel
});
},{"../models/question":5}],4:[function(require,module,exports){
"use strict";
module.exports = Backbone.Model.extend({});
},{}],5:[function(require,module,exports){
arguments[4][4][0].apply(exports,arguments)
},{"dup":4}],6:[function(require,module,exports){
"use strict";
module.exports = Backbone.Router.extend({
	routes: {
		"": "intro",
		"hello": "hello",
		"conversation": "conversation",
		'*error': 'error'
	}
});
},{}],7:[function(require,module,exports){
"use strict";
var PeopleView = require("./conversation/people");
var QuestionsView = require("./conversation/questions");
var ResponseView = require("./conversation/response");

module.exports = Backbone.View.extend({
	className: "view conversation",
	initialize: function() {
		this.render();
		
		// Child views
		this.peopleView = new PeopleView();
		this.$el.append(this.peopleView.el);
		this.questionsView = new QuestionsView();
		this.$el.append(this.questionsView.el);
		this.responseView = new ResponseView();
		this.$el.append(this.responseView.el);
	},
	render: function() {
		var self = this;

		$.get("/templates/conversation.html", function(data) {
			self.$el.append(data);
			self.$el.hammer({domEvents: true});
			self.trigger("loaded");
		});
		
		return self;
	},
	events: {
		"click .ask": "askAnotherQuestion",
		"click .how, footer .close": "howToggler",
		"revealAllQuestions": "askAnotherQuestion",
		"hidAllExceptSelectedQuestion": "prepareForResponse",
		"revealedAllQuestions": "hideResponse",
		"dataSourced": "getAndShowResponse",
		"panstart": "panHandler",
		"pan": "panHandler",
		"swiped": "swipeHandler",
	},
	panHandler: function(e) {
		// Prevent pan/swipe on response view and modal
		if(
			e.originalEvent &&
			!$(e.target).parents(".response").length &&
			!$(e.target).hasClass("response") &&
			!$(e.target).parents(".modal").length &&
			!$(e.target).hasClass("modal")
		) {
			this.peopleView.panHandler(e);
		}
	},
	swipeHandler: function(event, objects) {
		this.peopleView.swipeHandler(objects.event);
		
		if(this.questionsView.selectedQuestion) {
			// Reset response view
			this.responseView.setToLoading();
			
			// Prepare for response
			this.prepareForResponse();
		}
	},
	howToggler: function() {
		var $know = this.$(".know");
		
		$know.toggleClass("off", $know.hasClass("on"));
		$know.toggleClass("on", !$know.hasClass("on"));
	},
	askAnotherQuestion: function() {
		this.questionsView.revealAllQuestions();
	},
	prepareForResponse: function() {
		this.responseView.prepare(this.questionsView.selectedQuestion);
		TweenMax.to(this.$(".lower"), .5, {opacity: 1});
		
		// This will start the chiclets loading
		this.peopleView.selectedPerson.obtainData();
	},
	getAndShowResponse: function() {
		// Clear previous listens
		this.stopListening(this.responseView, "answerReady");
		
		// Clear old timeouts and requests
		if(this.responseView.jqxhr) {
			this.responseView.jqxhr.abort();
		}
		if(this.responseView.timeout) {
			clearTimeout(this.responseView.timeout);
		}
		
		// Listen for when the answer is ready to display
		this.listenToOnce(this.responseView, "answerReady", function() {
			// Check if still the current question and person
			if(
				this.peopleView.selectedPerson &&
				this.questionsView.selectedQuestion &&
				this.peopleView.selectedPerson.cid == this.responseView.answer.cid &&
				this.questionsView.selectedQuestion.model.get("id") == this.responseView.answer.questionID
			) {
				this.responseView.show();
			}
		});
		
		this.responseView.get(
			this.peopleView.selectedPerson,
			this.questionsView.selectedQuestion
		);
	},
	hideResponse: function() {
		this.responseView.hide();
		TweenMax.to(this.$(".lower"), .5, {opacity: 0});
	}
});
},{"./conversation/people":8,"./conversation/questions":10,"./conversation/response":13}],8:[function(require,module,exports){
"use strict";
var PeopleCollection = require("../../collections/people");
var PersonView = require("./people/person");

module.exports = Backbone.View.extend({
	className: "people",
	tagName: "ul",
	swipeThreshold: 125,
	initialize: function() {
		var self = this;
		
		$.getJSON("/scripts/json/people.js", function(data) {
			self.peopleCollection = new PeopleCollection(data);
			self.views = [];
			
			// Create current selected person view
			self.views.push(new PersonView({model: self.peopleCollection.first()}));
			
			// Set selected person to center
			self.setSelectedPerson(self.views[0]);
			
			// Draw people
			self.render();
		});
	},
	render: function() {
		// Add selected person
		this.$el.html(this.views[0].el);

		// Add the others around
		this.pad();
		
		// Set ending position
		this.positionLeft = -1196;

		return self;
	},
	setSelectedPerson: function(view) {
		// Turn off current selected person
		if(this.selectedPerson) {
			this.selectedPerson.selected = false;
		}
		
		this.selectedPerson = view;
		view.selected = true;
	},
	pad: function() {
		// Pads to 5 elements total, around the selected person
		
		// Get location in views of selected person
		var indexOfSelectedPerson = this.views.indexOf(this.selectedPerson);
		var modelIndex, model, view;
		
		// Generate and add views before the selected person
		while(indexOfSelectedPerson < 2) {
			// Get index of first view
			modelIndex = this.peopleCollection.indexOf(this.views[0].model);
			
			// Determine which model to use
			if(modelIndex === 0) {
				model =  this.peopleCollection.last();
			} else {
				model = this.peopleCollection.at(modelIndex - 1);
			}

			view = new PersonView({model: model});
			this.views.unshift(view);
			this.$el.prepend(view.el);
			
			indexOfSelectedPerson = this.views.indexOf(this.selectedPerson);
		}
		
		
		// Add views for after the selected person
		while(this.views.length < 5) {
			// Get index of last view
			modelIndex = this.peopleCollection.indexOf(_.last(this.views).model);
			
			// Determine which model to use
			if(modelIndex == _.size(this.peopleCollection) - 1) {
				model =  this.peopleCollection.first();
			} else {
				model = this.peopleCollection.at(modelIndex + 1);
			}

			view = new PersonView({model: model});
			this.views.push(view);
			this.$el.append(view.el);
		}
	},
	panHandler: function(e) {
		var self = this;

		if(e.originalEvent.gesture.isFinal) {
			// Fire event to parent if swipe, otherwise snap back
			if(
				e.originalEvent.gesture.deltaX < -self.swipeThreshold ||
				e.originalEvent.gesture.deltaX > self.swipeThreshold)
			{
				self.$el.trigger("swiped", {event: e});
			} else {
				TweenMax.to(self.$el, .1, {left: self.positionLeft});
			}
		} else {
			// Find new position and move
			var left = self.positionLeft + e.originalEvent.gesture.deltaX;
			self.$el.css({left: left});
		}
	},
	swipeHandler: function(e) {
		var self = this;
		var currentIndex = self.views.indexOf(self.selectedPerson);
		
		// Determine swipe direction
		if(e.originalEvent.gesture.deltaX < 0) {
			// Set to forward one
			self.setSelectedPerson(self.views[currentIndex + 1]);
			
			// Animate to correct position
			TweenMax.to(self.$el, .1, {
				left: self.positionLeft - 640,
				onComplete: function() {
					// Remove all aspects of edge view
					_.first(self.views).remove();
					self.views.shift();
					
					// Add in new
					self.pad();
					
					// Reset margins
					self.$("> li:first-child").css({marginLeft: 0});
					self.$("> li:nth-child(n + 2)").css({marginLeft: "40px"});
					
					// Adjust positioning
					self.$el.css({left: self.positionLeft});
				}
			});
		} else {
			// Set to back one
			self.setSelectedPerson(self.views[currentIndex - 1]);
			
			// Animate to correct position
			TweenMax.to(self.$el, .1, {
				left: self.positionLeft + 640,
				onComplete: function() {
						// Remove all aspects of edge view
					_.last(self.views).remove();
					self.views.pop();
					
					// Add in new
					self.pad();
					
					// Reset margins
					self.$("> li:first-child").css({marginLeft: 0});
					self.$("> li:nth-child(n + 2)").css({marginLeft: "40px"});
					
					// Adjust positioning
					self.$el.css({left: self.positionLeft});
				}
			});
		}
	}
});
},{"../../collections/people":2,"./people/person":9}],9:[function(require,module,exports){
"use strict";
module.exports = Backbone.View.extend({
	tagName: "li",
	initialize: function() {
		var self = this;
		
		$.get("/templates/conversation/people/person.html", function(data) {
			self.template = _.template(data);
			self.render();
		});
		
		$.get("/templates/conversation/people/person/modal.html", function(data) {
			self.modalTemplate = _.template(data);
		});
	},
	render: function() {
		this.$el.html(this.template(this.model.toJSON()));
		return this;
	},
	events: {
		"click .picture": "popupHandler",
		"click .sources li": "popupHandler",
		"click .popup button": "reportToggler",
		"click .modal button": "reportToggler"
	},
	reportToggler: function() {
		var $modal = this.$el.find(".modal");
		
		// Create modal if needed, otherwise remove
		if(!$modal.length) {
			this.$el.append(this.modalTemplate(this.model.toJSON()));
			$modal = this.$(".modal");
			
			$modal.waitForImages(function() {
				$modal.removeClass("spinner").addClass("spinOut");
				TweenMax.fromTo($modal.find("> div"), .5,
					{opacity: 0, visibility: "visible"},
					{opacity: 1, onComplete: function() {
						$modal.removeClass("spinOut");
					}}
				);
			});

			// Prevent background clicks
			$modal.on("touchstart mousedown click", function(e) {
				if(!$(e.target).is($modal.find("button"))) {
					e.stopImmediatePropagation();
				}
			});
		} else {
			TweenMax.to($modal, .5, {opacity: 0, onComplete: function() {
				$modal.remove();
			}});
		}
	},
	obtainData: function() {
		var self = this;
		
		self.$("li.available").each(function() {
			var $this = $(this);
			
			$this.removeClass("spinOut").addClass("spinner");

			// Data obtained after random time
			setTimeout(function() {
				$this.removeClass("spinner").addClass("spinOut");
			}, Math.floor(Math.random() * 2000 + 1000));
		});
		
		// Signal to parent data is ready
		self.$el.trigger("dataSourced");
	},
	popupHandler: function(e) {
		// Check if current person being clicked on
		if(this.selected) {
			e.stopImmediatePropagation();
			var self = this;
			var $newPopup = $(e.target).siblings(".popup");
			
			if(!self.$popup) {
				this.popupShower($newPopup);
			} else {
				var isSameAsCurrent = self.$popup.is($newPopup);

				// Hide current popup
				this.popupRemover(self.$popup);
				
				if(!isSameAsCurrent) {
					// Show new
					self.$popup = $newPopup;
					this.popupShower(self.$popup);
				}
			}
		}
	},
	popupRemover: function($p) {
		this.$popup = null;
		
		// Fade and hide popup
		TweenMax.to($p, .5, {
			opacity: 0,
			display: "none",
			overwrite: "all"
		});

		// Turn off listener
		$("body").off("touchend click");
	},
	popupShower: function($p) {
		var self = this;
		
		self.$popup = $p;
		
		// Show and fade in
		TweenMax.fromTo($p, .5,
			{opacity: 0, display: "block"},
			{opacity: 1, overwrite: "all"}
		);
		
		// Listen for anything to turn off
		$("body").one("touchend click", function() {
			self.popupRemover($p);
		});
	}
});
},{}],10:[function(require,module,exports){
"use strict";
var QuestionModel = require("../../models/question");
var QuestionsCollection = require("../../collections/questions");
var QuestionView = require("./questions/question");
var CustomQuestionView = require("./questions/customQuestion");

module.exports = Backbone.View.extend({
	className: "questions",
	tagName: "ul",
	initialize: function() {
		var self = this;
		
		$.getJSON("/scripts/json/questions.js", function(data) {
			self.questionsCollection = new QuestionsCollection(data);
			self.views = [];

			// Create question views
			self.questionsCollection.each(function(model) {
				self.views.push(new QuestionView({model: model}));
			});
			
			// Add in custom question
			self.views.push(new CustomQuestionView({
				model: new QuestionModel()
			}));
			
			self.render();
		});
	},
	render: function() {
		var self = this;
		
		self.$el.empty();
		
		var container = document.createDocumentFragment();
		
		// Render each question and add at end
		_.each(self.views, function(view) {
			container.appendChild(view.el);
		});
		
		self.$el.append(container);
		
		return self;
	},
	events: {
		"questionClicked": "questionClicked",
		"regenerateCustomQuestion": "regenerateCustomQuestion"
	},
	questionClicked: function(event, objects) {
		if(!this.selectedQuestion) {
			// Save view and hide others
			this.selectedQuestion = objects.selectedQuestion;
			this.hideAllExceptSelectedQuestion();
		} else {
			this.$el.trigger("revealAllQuestions");
		}
	},
	hideAllExceptSelectedQuestion: function() {
		var self = this;
		
		// Bubble up the event
		self.$el.trigger("hidAllExceptSelectedQuestion");
		
		_.each(this.views, function(view) {
			if(view == self.selectedQuestion) {
				// Save current offset
				var currentOffset = view.$el.offset();
				
				view.$el.css("position", "absolute");
				
				// Save desired offset
				var desiredOffset = view.$el.offset();
				
				view.$el.css("position", "relative");
				
				// Reset positioning and move question
				TweenMax.to(view.$el, .5, {
					top: desiredOffset.top - currentOffset.top
				});
			} else {
				// Hide all other questions
				TweenMax.to(view.$el, .5, {autoAlpha: 0});
			}
		});
	},
	revealAllQuestions: function() {
		var self = this;
		
		if(self.selectedQuestion) {
			// Bubble up the event
			self.$el.trigger("revealedAllQuestions");
			
			_.each(this.views, function(view) {
				// Reset custom question
				if(view instanceof CustomQuestionView) {
					view.stale();
				}
				
				if(view == self.selectedQuestion) {
					self.selectedQuestion = null;
					
					// Animate back to position, if needed
					if(!view.$el.is(":first-child")) {
						TweenMax.to(view.$el, .5, {
							top: 0,
							onComplete: function() {
								if(view instanceof CustomQuestionView) {
									self.regenerateCustomQuestion();
								}
							}
						});
					}
				} else {
					// Reveal other questions
					TweenMax.to(view.$el, .5, {autoAlpha: 1});
				}
			});
		}
	},
	regenerateCustomQuestion: function() {
		var self = this;
		
		// Bring current out of position
		var current = self.views.slice(-1)[0];
		current.$el.css({
			position: "absolute",
			top: current.$el.position().top,
			left: current.$el.position().left,
			width: current.$el.outerWidth(),
			zIndex: 10
		});
		
		// Add in new one
		var view = new CustomQuestionView({model: new QuestionModel()});
		self.$el.append(view.el);
		
		// Remove old when new present
		var i = setInterval(function() {
			if(jQuery.contains(self.el, view.el)) {
				clearInterval(i);
				
				current.remove();
				
				// Cleanup array
				self.views.pop();
				self.views.push(view);
			}
		}, 1);
	}
});
},{"../../collections/questions":3,"../../models/question":5,"./questions/customQuestion":11,"./questions/question":12}],11:[function(require,module,exports){
"use strict";
module.exports = Backbone.View.extend({
	tagName: "li",
	className: "custom",
	status: "stale",
	initialize: function() {
		this.render();
	},
	render: function() {
		var self = this;
		
		$.get("/templates/conversation/questions/custom.html", function(data) {
			self.$el.append(data);
			self.$input = self.$("input");
			self.$button = self.$("button");
			self.$button.css("display", "none");
		});
		
		return this;
	},
	events: {
		"click": "router",
		"keyup input": "keyHandler"
	},
	router: function(e) {
		if($(e.target).is(this.$button) && this.$input.val() !== "") {
			this.selected();
		} else if(this.status == "selected") {
			this.$el.trigger("questionClicked", {selectedQuestion: this});
		} else {
			this.editing();
		}
	},
	keyHandler: function(e) {
		if(e.keyCode == 13){
			this.$button.click();
		}
	},
	editing: function() {
		var self = this;
		
		self.status = "editing";
		
		// Allow editing
		self.$input.prop("readonly", false).focus();
		
		// Animate if not already done
		if(!self.$el.hasClass("focused")) {
			TweenMax.to(self.$el, .5, {className: "+=focused"});
			
			TweenMax.fromTo(self.$button, .5,
				{opacity: 0, display: "block"},
				{opacity: 1}
			);
		}
	},
	selected: function() {
		var self = this;
		
		self.status = "selected";
		
		// Save data to moodel
		self.model.set({"text": self.$input.val()});
		
		// Disable editing and shrink
		self.$input.blur().prop("readonly", true);
		self.shrink();

		// Fire event to parent
		self.$el.trigger("questionClicked", {selectedQuestion: self});
	},
	stale: function() {
		this.$input.val("");
		
		if(this.status == "editing") {
			this.shrink();
		}
		
		this.status = "stale";
	},
	shrink: function() {
		var self = this;
		
		TweenMax.to(self.$el, .5, {className: "-=focused"});
		
		TweenMax.to(self.$button, .5, {
			opacity: 0,
			display: "none"
		});
	}
});
},{}],12:[function(require,module,exports){
"use strict";
module.exports = Backbone.View.extend({
	tagName: "li",
	template: _.template("<%= text %>"),
	initialize: function() {
		this.render();
	},
	render: function() {
		this.$el.html(this.template(this.model.toJSON()));
		return this;
	},
	events: {
		"click": "clicked"
	},
	clicked: function() {
		this.$el.trigger("questionClicked", {selectedQuestion: this});
	}
});
},{}],13:[function(require,module,exports){
"use strict";
/*jshint -W083, -W008 */

var config = require("../../../config");

module.exports = Backbone.View.extend({
	className: "response",
	initialize: function() {
		var self = this;
		
		// Load data and start
		var a1 = $.getJSON("/scripts/json/genes.js");
		var a2 = $.getJSON("/scripts/json/answers.js");
		var a3 = $.get("/templates/conversation/response/genes.html");
		
		$.when(a1, a2, a3).done(function(r1, r2, r3) {
			self.genes = r1[0];
			self.answers = r2[0];
			self.genesTemplate = _.template(r3[0]);
			self.render();
			self.setToLoading();
		});
	},
	render: function() {
		this.setToLoading();
		this.$el.hide();
		return this;
	},
	events: {
		"click footer div:nth-last-child(-n + 2)": "markRated"
	},
	markRated: function(e) {
		$(e.currentTarget).parent().find("div").removeClass("clicked");
		$(e.currentTarget).addClass("clicked");
	},
	setToLoading: function() {
		this.$el
			.empty()
			.addClass("spinner")
			.removeClass("spinOut")
			.removeClass("has-map")
			.removeClass("has-genes")
		;
	},
	prepare: function(answer) {
		var self = this;

		// Adjust size of answer area based on question size
		var top = answer.$el.parent().offset().top + 58 + 10;
		var height = 520 - 58;
		
		self.$el.css({
			display: "block",
			top: top,
			height: height
		});
		
		// Fade in response
		TweenMax.fromTo(self.$el, .5, {opacity: 0}, {opacity: 1, overwrite: "all"});
	},
	get: function(person, question) {
		var self = this;
		var requestData;
		self.answer = {};
		self.answer.cid = person.cid;
		self.answer.personID = person.model.get("id");
		self.answer.questionID = question.model.get("id");
		self.answer.html = "";
		
		var numberWithCommas = function(x) {
			return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		};
		
		// Gene list
		if([1, 2, 3].indexOf(self.answer.questionID) > -1) {
			self.answer.genes = self.genesTemplate(self.genes[question.model.get("genes")]);
		}
		
		// Get answer and map, depending on stored response
		if(self.answer.questionID < 4) {
			var html = "";
			
			switch(self.answer.questionID) {
				case 1:
					// Get fitness data about person
					requestData = {
						"userId": self.answer.personID,
						"fitness": "true"
					};
					
					// Get the answer
					self.jqxhr = $.ajax({
						url: config.url,
						data: requestData,
						dataType: "jsonp",
						timeout: 3000
					}).always(function(data, status, jqxhr) {
						if(status == "success" && data.fitness.code === 0) {
							var randomNumber = Math.floor(Math.random() * 6);
							var randomResponse;
							
							// Generate random response
							if(randomNumber != 4) {
								randomResponse = self.answers[0].responses[randomNumber];
							} else {
								randomResponse =
									self.answers[0].responses[randomNumber][0] +
									self.answers[0].locations[self.answer.personID - 1].title +
									self.answers[0].responses[randomNumber][1] +
									self.answers[0].locations[self.answer.personID - 1].address +
									self.answers[0].responses[randomNumber][2]
								;
								
								// Assign single location
								self.answer.locations = [self.answers[0].locations[self.answer.personID - 1]];
							}
							
							html =
								person.model.get("name") +
								self.answers[0].parts[0] +
								"<span class='highlight'>" + numberWithCommas(data.fitness.summary.caloriesOut) + "</span>" +
								self.answers[0].parts[1] +
								person.model.get("goals") +
								self.answers[0].parts[2] +
								randomResponse
							;
							self.answer.html = html;
						} else {
							self.answer.html = "<p>Sorry, please try again.</p>";
						}

						self.timeout = setTimeout(function() {self.trigger("answerReady");}, 2500);
					});
					
					
					break;
				case 2:
					self.answer.html = self.answers[1][self.answer.personID - 1].html;
					
					var locations = self.answers[1][self.answer.personID - 1].locations;
					
					// Add location names to html
					self.answer.html += "<ul>";
					
					for(var i = 0; i < locations.length; i++) {
						self.answer.html += "<li>" + locations[i].title + "</li>";
					}
					
					self.answer.html += "</ul>";
					
					self.answer.locations = locations;
					self.timeout = setTimeout(function() {self.trigger("answerReady");}, 3000);
					break;
				case 3:
					self.answer.html = self.answers[2][self.answer.personID - 1];
					self.timeout = setTimeout(function() {self.trigger("answerReady");}, 3000);
					break;
			}
		} else {
			// To be sent to API
			requestData = {
				"userId": 1, // self.answer.personID,
				"question": {
					"questionText": question.model.get("text")
				}
			};
			
			// Get the answer
			self.jqxhr = $.ajax({
				url: config.url,
				data: requestData,
				dataType: "jsonp",
				timeout: 15000
			}).always(function(data, status, jqxhr) {
				if(status == "success" && data.answer.answers[0]) {
					if(self.answer.questionID == 5 && self.answer.personID == 2) {
						self.answer.html += self.answers[3];
					}
					
					self.answer.html += data.answer.answers[0].formattedText;
				} else {
					self.answer.html = "<p>Sorry, please try again.</p>";
				}
				
				self.trigger("answerReady");
			});
		}
	},
	show: function() {
		var self = this;
		
		// Gracefully hide spinner
		self.$el.removeClass("spinner").addClass("spinOut");
		
		if(self.answer.html) {
			self.$el.append("<main>" + self.answer.html + "</main>");
		} else {
			self.$el.append("<main><p>Sorry, please try again later.</p></main>");
		}
		
		// Show genes if so
		if(self.answer.genes) {
			self.$el.addClass("has-genes");
			self.$el.append(self.answer.genes);
		}
		
		// Show map if locations are available
		if(self.answer.locations) {
			self.$el.addClass("has-map");
			self.$el.append("<div class='container'><div id='map'></div></div>");
			
			$.getJSON("/scripts/json/map.js", function(styles) {
				var styledMap = new google.maps.StyledMapType(
					styles,
					{name: "Styled"}
				);
				
				var mapOptions = {
					mapTypeControlOptions: {
						mapTypeIds: [google.maps.MapTypeId.ROADMAP, "map_style"]
					},
					mapTypeControl: false,
					streetViewControl: false,
					zoomControl: true,
					zoomControlOptions: {
						style: google.maps.ZoomControlStyle.LARGE,
						position: google.maps.ControlPosition.LEFT_TOP
					}
				};
				
				var map = new google.maps.Map(document.getElementById("map"), mapOptions);
				
				map.mapTypes.set("map_style", styledMap);
				map.setMapTypeId("map_style");
				
				var bounds = new google.maps.LatLngBounds();
				var infowindow = new google.maps.InfoWindow();  
				
				// Add markers
				for (var i = 0; i < self.answer.locations.length; i++) {
					// Format title
					var content = "";
					
					if(self.answer.locations[i].title) {
						content = "<div class='title'>" + self.answer.locations[i].title + "</div>";
					}
					if(self.answer.locations[i].description) {
						content += "<div class='description'>" + self.answer.locations[i].description + "</div>";
					}
					
					var marker = new google.maps.Marker({
						position: new google.maps.LatLng(
							self.answer.locations[i].coordinates.lattitude,
							self.answer.locations[i].coordinates.longitude
						),
						map: map,
						title: content,
						visible: true
					});
					
					//extend the bounds to include each marker's position
					bounds.extend(marker.position);
					
					google.maps.event.addListener(marker, "click", (function(marker, i) {
						return function() {
							infowindow.setContent(marker.title);
							infowindow.open(map, marker);
						};
					})(marker, i));
				}
				
				map.fitBounds(bounds);

				// Zoom out for single destination maps
				if(self.answer.locations.length < 2) {
					var listener = google.maps.event.addListener(map, "idle", function () {
						map.setZoom(11);
						google.maps.event.removeListener(listener);
					});
				}
			});
		}

		// Add in thumbs up and down
		$.get("/templates/conversation/response/footer.html", function(data) {
			self.$el.append(data);
		});
	},
	hide: function() {
		var self = this;
		
		TweenMax.fromTo(self.$el, .5, {opacity: 1}, {
			opacity: 0,
			display: "none",
			onComplete: function() {
				self.setToLoading();
			}
		});
	}
});
},{"../../../config":16}],14:[function(require,module,exports){
"use strict";
module.exports = Backbone.View.extend({
	className: "view hello",
	initialize: function() {
		var self = this;
		
		self.render();
		
		// Button to end
		self.$el.one("click", "button", function() {
			self.trigger("end");
		});
	},
	render: function() {
		var self = this;

		self.$el.load("/templates/hello.html", function() {
			// Signal to parent
			self.trigger("loaded");
		});
		
		return self;
	}
});
},{}],15:[function(require,module,exports){
"use strict";
module.exports = Backbone.View.extend({
	className: "view intro",
	initialize: function() {
		var self = this;
		
		self.render();
		
		setTimeout(function() {self.trigger("end");}, 7000);
	},
	render: function() {
		var self = this;

		self.$el.load("/templates/intro.html", function() {
			// Signal to parent
			self.trigger("loaded");
		});
		
		return self;
	}
});
},{}],16:[function(require,module,exports){
"use strict";
module.exports = {
	url: "http://" + window.location.host + "/ask",
	//url: "http://atldev.pathway.com:3000/ask"
	//url: "http://ome-demo.pathway.com:8080/ask",
};
},{}],17:[function(require,module,exports){
"use strict";
var AppView = require("./app");

//	Initiation
$(window).load(function() {
	// Timer code
	var resetTimer = function(t) {
		if(t === 0) {
			clearTimeout(timer);
		}
		if(t > 90) {
			//window.location.replace("/");
		} else {
			t++;
			timer = setTimeout(function() {resetTimer(t);}, 1000);
		}
	};
	
	// Start timer
	var timer = setTimeout(function() {resetTimer(0);}, 1000);
	
	$(document).on("touchstart mousedown", function(e) {
		// Prevent scrolling on any touches to screen
		$(this).preventScrolling(e);
		
		// Reset timer
		resetTimer(0);
	});
	
	// Fast clicks for touch users
	FastClick.attach(document.body);
	
	// Start!
	window.app = new AppView();
});
},{"./app":1}]},{},[17])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzY3JpcHRzL2FwcC5qcyIsInNjcmlwdHMvYXBwL2NvbGxlY3Rpb25zL3Blb3BsZS5qcyIsInNjcmlwdHMvYXBwL2NvbGxlY3Rpb25zL3F1ZXN0aW9ucy5qcyIsInNjcmlwdHMvYXBwL21vZGVscy9wZXJzb24uanMiLCJzY3JpcHRzL2FwcC9yb3V0ZXIuanMiLCJzY3JpcHRzL2FwcC92aWV3cy9jb252ZXJzYXRpb24uanMiLCJzY3JpcHRzL2FwcC92aWV3cy9jb252ZXJzYXRpb24vcGVvcGxlLmpzIiwic2NyaXB0cy9hcHAvdmlld3MvY29udmVyc2F0aW9uL3Blb3BsZS9wZXJzb24uanMiLCJzY3JpcHRzL2FwcC92aWV3cy9jb252ZXJzYXRpb24vcXVlc3Rpb25zLmpzIiwic2NyaXB0cy9hcHAvdmlld3MvY29udmVyc2F0aW9uL3F1ZXN0aW9ucy9jdXN0b21RdWVzdGlvbi5qcyIsInNjcmlwdHMvYXBwL3ZpZXdzL2NvbnZlcnNhdGlvbi9xdWVzdGlvbnMvcXVlc3Rpb24uanMiLCJzY3JpcHRzL2FwcC92aWV3cy9jb252ZXJzYXRpb24vcmVzcG9uc2UuanMiLCJzY3JpcHRzL2FwcC92aWV3cy9oZWxsby5qcyIsInNjcmlwdHMvYXBwL3ZpZXdzL2ludHJvLmpzIiwic2NyaXB0cy9jb25maWcuanMiLCJzY3JpcHRzL21haW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7Ozs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlIHN0cmljdFwiO1xudmFyIEludHJvVmlldyA9IHJlcXVpcmUoXCIuL2FwcC92aWV3cy9pbnRyb1wiKTtcbnZhciBIZWxsb1ZpZXcgPSByZXF1aXJlKFwiLi9hcHAvdmlld3MvaGVsbG9cIik7XG52YXIgQ29udmVyc2F0aW9uVmlldyA9IHJlcXVpcmUoXCIuL2FwcC92aWV3cy9jb252ZXJzYXRpb25cIik7XG52YXIgUm91dGVyID0gcmVxdWlyZShcIi4vYXBwL3JvdXRlclwiKTtcblxubW9kdWxlLmV4cG9ydHMgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cdGVsOiBcIiNhcHBcIixcblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdFxuXHRcdC8vIFN0YXJ0IHJvdXRlciB3aXRoIHByZWRlZmluZWQgcm91dGVzXG5cdFx0dGhpcy5yb3V0ZXIgPSBuZXcgUm91dGVyKCk7XG5cdFx0XG5cdFx0Ly8gUm91dGUgYWN0aW9uc1xuXHRcdHRoaXMucm91dGVyLm9uKFwicm91dGU6aW50cm9cIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgdmlldyA9IG5ldyBJbnRyb1ZpZXcoKTtcblx0XHRcdFxuXHRcdFx0c2VsZi5nb1RvKHZpZXcpO1xuXHRcdFx0XG5cdFx0XHQvLyBMaXN0ZW4gZm9yIGVuZCBvZiB2aWV3XG5cdFx0XHRzZWxmLmxpc3RlblRvT25jZSh2aWV3LCBcImVuZFwiLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0c2VsZi5yb3V0ZXIubmF2aWdhdGUoXCJoZWxsb1wiLCB7dHJpZ2dlcjogdHJ1ZX0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0XG5cdFx0dGhpcy5yb3V0ZXIub24oXCJyb3V0ZTpoZWxsb1wiLCBmdW5jdGlvbigpIHtcblx0XHRcdHZhciB2aWV3ID0gbmV3IEhlbGxvVmlldygpO1xuXHRcdFx0XG5cdFx0XHRzZWxmLmdvVG8odmlldyk7XG5cdFx0XHRcblx0XHRcdC8vIExpc3RlbiBmb3IgZW5kIG9mIHZpZXdcblx0XHRcdHNlbGYubGlzdGVuVG9PbmNlKHZpZXcsIFwiZW5kXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRzZWxmLnJvdXRlci5uYXZpZ2F0ZShcImNvbnZlcnNhdGlvblwiLCB7dHJpZ2dlcjogdHJ1ZX0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0XG5cdFx0dGhpcy5yb3V0ZXIub24oXCJyb3V0ZTpjb252ZXJzYXRpb25cIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgY29udmVyc2F0aW9uVmlldyA9IG5ldyBDb252ZXJzYXRpb25WaWV3KCk7XG5cdFx0XHRcblx0XHRcdHNlbGYuZ29Ubyhjb252ZXJzYXRpb25WaWV3KTtcblx0XHR9KTtcblx0XHRcblx0XHQvLyBTdGFydCB0cmFja2luZ1xuXHRcdEJhY2tib25lLmhpc3Rvcnkuc3RhcnQoe3B1c2hTdGF0ZTogdHJ1ZX0pO1xuXHR9LFxuXHRldmVudHM6IHtcblx0XHRcImNsaWNrIC5yZWZyZXNoXCI6IFwicmVmcmVzaFwiXG5cdH0sXG5cdHJlZnJlc2g6IGZ1bmN0aW9uKCkge1xuXHRcdHdpbmRvdy5sb2NhdGlvbi5yZXBsYWNlKFwiL1wiKTtcblx0fSxcblx0Z29UbzogZnVuY3Rpb24odmlldykge1xuXHRcdHZhciBzZWxmID0gdGhpcztcblx0XHR2YXIgcHJldmlvdXMgPSB0aGlzLmN1cnJlbnRWaWV3IHx8IG51bGw7XG5cdFx0dmFyIG5leHQgPSB2aWV3O1xuXHRcdFxuXHRcdC8vIEhpZGUgdGhlIGN1cnJlbnQgdmlld1xuXHRcdGlmKHByZXZpb3VzKSB7XG5cdFx0XHRUd2Vlbk1heC50byhwcmV2aW91cy4kZWwsIC41LCB7XG5cdFx0XHRcdG9wYWNpdHk6IDAsXG5cdFx0XHRcdG9uQ29tcGxldGU6IGZ1bmN0aW9uKCkge3ByZXZpb3VzLnJlbW92ZSgpO31cblx0XHRcdH0pO1xuXHRcdH1cblx0XHRcblx0XHQvLyBBZGQgLCBoaWRlLCBhbmQgd2FpdCB1bnRpbCBsb2FkZWRcblx0XHRzZWxmLmN1cnJlbnRWaWV3ID0gbmV4dDtcblx0XHRzZWxmLiRlbC5hcHBlbmQobmV4dC5lbCk7XG5cdFx0bmV4dC4kZWwuaGlkZSgpO1xuXHRcdFxuXHRcdHNlbGYubGlzdGVuVG9PbmNlKG5leHQsIFwibG9hZGVkXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0Ly8gV2FpdCBmb3IgaW1hZ2VzIGFuZCByZXZlYWxcblx0XHRcdG5leHQuJGVsLndhaXRGb3JJbWFnZXMoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHNlbGYuJGVsLnJlbW92ZUNsYXNzKFwic3Bpbm5lclwiKS5hZGRDbGFzcyhcInNwaW5PdXRcIik7XG5cdFx0XHRcdG5leHQuJGVsLnNob3coKTtcblx0XHRcdFx0VHdlZW5NYXguZnJvbShuZXh0LiRlbCwgLjUsIHtvcGFjaXR5OiAwfSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSxcbn0pOyIsIlwidXNlIHN0cmljdFwiO1xudmFyIFBlcnNvbk1vZGVsID0gcmVxdWlyZShcIi4uL21vZGVscy9wZXJzb25cIik7XG5cbm1vZHVsZS5leHBvcnRzID0gQmFja2JvbmUuQ29sbGVjdGlvbi5leHRlbmQoe1xuXHRtb2RlbDogUGVyc29uTW9kZWxcbn0pOyIsIlwidXNlIHN0cmljdFwiO1xudmFyIFF1ZXN0aW9uTW9kZWwgPSByZXF1aXJlKFwiLi4vbW9kZWxzL3F1ZXN0aW9uXCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJhY2tib25lLkNvbGxlY3Rpb24uZXh0ZW5kKHtcblx0bW9kZWw6IFF1ZXN0aW9uTW9kZWxcbn0pOyIsIlwidXNlIHN0cmljdFwiO1xubW9kdWxlLmV4cG9ydHMgPSBCYWNrYm9uZS5Nb2RlbC5leHRlbmQoe30pOyIsIlwidXNlIHN0cmljdFwiO1xubW9kdWxlLmV4cG9ydHMgPSBCYWNrYm9uZS5Sb3V0ZXIuZXh0ZW5kKHtcblx0cm91dGVzOiB7XG5cdFx0XCJcIjogXCJpbnRyb1wiLFxuXHRcdFwiaGVsbG9cIjogXCJoZWxsb1wiLFxuXHRcdFwiY29udmVyc2F0aW9uXCI6IFwiY29udmVyc2F0aW9uXCIsXG5cdFx0JyplcnJvcic6ICdlcnJvcidcblx0fVxufSk7IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgUGVvcGxlVmlldyA9IHJlcXVpcmUoXCIuL2NvbnZlcnNhdGlvbi9wZW9wbGVcIik7XG52YXIgUXVlc3Rpb25zVmlldyA9IHJlcXVpcmUoXCIuL2NvbnZlcnNhdGlvbi9xdWVzdGlvbnNcIik7XG52YXIgUmVzcG9uc2VWaWV3ID0gcmVxdWlyZShcIi4vY29udmVyc2F0aW9uL3Jlc3BvbnNlXCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblx0Y2xhc3NOYW1lOiBcInZpZXcgY29udmVyc2F0aW9uXCIsXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0XG5cdFx0Ly8gQ2hpbGQgdmlld3Ncblx0XHR0aGlzLnBlb3BsZVZpZXcgPSBuZXcgUGVvcGxlVmlldygpO1xuXHRcdHRoaXMuJGVsLmFwcGVuZCh0aGlzLnBlb3BsZVZpZXcuZWwpO1xuXHRcdHRoaXMucXVlc3Rpb25zVmlldyA9IG5ldyBRdWVzdGlvbnNWaWV3KCk7XG5cdFx0dGhpcy4kZWwuYXBwZW5kKHRoaXMucXVlc3Rpb25zVmlldy5lbCk7XG5cdFx0dGhpcy5yZXNwb25zZVZpZXcgPSBuZXcgUmVzcG9uc2VWaWV3KCk7XG5cdFx0dGhpcy4kZWwuYXBwZW5kKHRoaXMucmVzcG9uc2VWaWV3LmVsKTtcblx0fSxcblx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0XHQkLmdldChcIi90ZW1wbGF0ZXMvY29udmVyc2F0aW9uLmh0bWxcIiwgZnVuY3Rpb24oZGF0YSkge1xuXHRcdFx0c2VsZi4kZWwuYXBwZW5kKGRhdGEpO1xuXHRcdFx0c2VsZi4kZWwuaGFtbWVyKHtkb21FdmVudHM6IHRydWV9KTtcblx0XHRcdHNlbGYudHJpZ2dlcihcImxvYWRlZFwiKTtcblx0XHR9KTtcblx0XHRcblx0XHRyZXR1cm4gc2VsZjtcblx0fSxcblx0ZXZlbnRzOiB7XG5cdFx0XCJjbGljayAuYXNrXCI6IFwiYXNrQW5vdGhlclF1ZXN0aW9uXCIsXG5cdFx0XCJjbGljayAuaG93LCBmb290ZXIgLmNsb3NlXCI6IFwiaG93VG9nZ2xlclwiLFxuXHRcdFwicmV2ZWFsQWxsUXVlc3Rpb25zXCI6IFwiYXNrQW5vdGhlclF1ZXN0aW9uXCIsXG5cdFx0XCJoaWRBbGxFeGNlcHRTZWxlY3RlZFF1ZXN0aW9uXCI6IFwicHJlcGFyZUZvclJlc3BvbnNlXCIsXG5cdFx0XCJyZXZlYWxlZEFsbFF1ZXN0aW9uc1wiOiBcImhpZGVSZXNwb25zZVwiLFxuXHRcdFwiZGF0YVNvdXJjZWRcIjogXCJnZXRBbmRTaG93UmVzcG9uc2VcIixcblx0XHRcInBhbnN0YXJ0XCI6IFwicGFuSGFuZGxlclwiLFxuXHRcdFwicGFuXCI6IFwicGFuSGFuZGxlclwiLFxuXHRcdFwic3dpcGVkXCI6IFwic3dpcGVIYW5kbGVyXCIsXG5cdH0sXG5cdHBhbkhhbmRsZXI6IGZ1bmN0aW9uKGUpIHtcblx0XHQvLyBQcmV2ZW50IHBhbi9zd2lwZSBvbiByZXNwb25zZSB2aWV3IGFuZCBtb2RhbFxuXHRcdGlmKFxuXHRcdFx0ZS5vcmlnaW5hbEV2ZW50ICYmXG5cdFx0XHQhJChlLnRhcmdldCkucGFyZW50cyhcIi5yZXNwb25zZVwiKS5sZW5ndGggJiZcblx0XHRcdCEkKGUudGFyZ2V0KS5oYXNDbGFzcyhcInJlc3BvbnNlXCIpICYmXG5cdFx0XHQhJChlLnRhcmdldCkucGFyZW50cyhcIi5tb2RhbFwiKS5sZW5ndGggJiZcblx0XHRcdCEkKGUudGFyZ2V0KS5oYXNDbGFzcyhcIm1vZGFsXCIpXG5cdFx0KSB7XG5cdFx0XHR0aGlzLnBlb3BsZVZpZXcucGFuSGFuZGxlcihlKTtcblx0XHR9XG5cdH0sXG5cdHN3aXBlSGFuZGxlcjogZnVuY3Rpb24oZXZlbnQsIG9iamVjdHMpIHtcblx0XHR0aGlzLnBlb3BsZVZpZXcuc3dpcGVIYW5kbGVyKG9iamVjdHMuZXZlbnQpO1xuXHRcdFxuXHRcdGlmKHRoaXMucXVlc3Rpb25zVmlldy5zZWxlY3RlZFF1ZXN0aW9uKSB7XG5cdFx0XHQvLyBSZXNldCByZXNwb25zZSB2aWV3XG5cdFx0XHR0aGlzLnJlc3BvbnNlVmlldy5zZXRUb0xvYWRpbmcoKTtcblx0XHRcdFxuXHRcdFx0Ly8gUHJlcGFyZSBmb3IgcmVzcG9uc2Vcblx0XHRcdHRoaXMucHJlcGFyZUZvclJlc3BvbnNlKCk7XG5cdFx0fVxuXHR9LFxuXHRob3dUb2dnbGVyOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgJGtub3cgPSB0aGlzLiQoXCIua25vd1wiKTtcblx0XHRcblx0XHQka25vdy50b2dnbGVDbGFzcyhcIm9mZlwiLCAka25vdy5oYXNDbGFzcyhcIm9uXCIpKTtcblx0XHQka25vdy50b2dnbGVDbGFzcyhcIm9uXCIsICEka25vdy5oYXNDbGFzcyhcIm9uXCIpKTtcblx0fSxcblx0YXNrQW5vdGhlclF1ZXN0aW9uOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnF1ZXN0aW9uc1ZpZXcucmV2ZWFsQWxsUXVlc3Rpb25zKCk7XG5cdH0sXG5cdHByZXBhcmVGb3JSZXNwb25zZTogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5yZXNwb25zZVZpZXcucHJlcGFyZSh0aGlzLnF1ZXN0aW9uc1ZpZXcuc2VsZWN0ZWRRdWVzdGlvbik7XG5cdFx0VHdlZW5NYXgudG8odGhpcy4kKFwiLmxvd2VyXCIpLCAuNSwge29wYWNpdHk6IDF9KTtcblx0XHRcblx0XHQvLyBUaGlzIHdpbGwgc3RhcnQgdGhlIGNoaWNsZXRzIGxvYWRpbmdcblx0XHR0aGlzLnBlb3BsZVZpZXcuc2VsZWN0ZWRQZXJzb24ub2J0YWluRGF0YSgpO1xuXHR9LFxuXHRnZXRBbmRTaG93UmVzcG9uc2U6IGZ1bmN0aW9uKCkge1xuXHRcdC8vIENsZWFyIHByZXZpb3VzIGxpc3RlbnNcblx0XHR0aGlzLnN0b3BMaXN0ZW5pbmcodGhpcy5yZXNwb25zZVZpZXcsIFwiYW5zd2VyUmVhZHlcIik7XG5cdFx0XG5cdFx0Ly8gQ2xlYXIgb2xkIHRpbWVvdXRzIGFuZCByZXF1ZXN0c1xuXHRcdGlmKHRoaXMucmVzcG9uc2VWaWV3LmpxeGhyKSB7XG5cdFx0XHR0aGlzLnJlc3BvbnNlVmlldy5qcXhoci5hYm9ydCgpO1xuXHRcdH1cblx0XHRpZih0aGlzLnJlc3BvbnNlVmlldy50aW1lb3V0KSB7XG5cdFx0XHRjbGVhclRpbWVvdXQodGhpcy5yZXNwb25zZVZpZXcudGltZW91dCk7XG5cdFx0fVxuXHRcdFxuXHRcdC8vIExpc3RlbiBmb3Igd2hlbiB0aGUgYW5zd2VyIGlzIHJlYWR5IHRvIGRpc3BsYXlcblx0XHR0aGlzLmxpc3RlblRvT25jZSh0aGlzLnJlc3BvbnNlVmlldywgXCJhbnN3ZXJSZWFkeVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdC8vIENoZWNrIGlmIHN0aWxsIHRoZSBjdXJyZW50IHF1ZXN0aW9uIGFuZCBwZXJzb25cblx0XHRcdGlmKFxuXHRcdFx0XHR0aGlzLnBlb3BsZVZpZXcuc2VsZWN0ZWRQZXJzb24gJiZcblx0XHRcdFx0dGhpcy5xdWVzdGlvbnNWaWV3LnNlbGVjdGVkUXVlc3Rpb24gJiZcblx0XHRcdFx0dGhpcy5wZW9wbGVWaWV3LnNlbGVjdGVkUGVyc29uLmNpZCA9PSB0aGlzLnJlc3BvbnNlVmlldy5hbnN3ZXIuY2lkICYmXG5cdFx0XHRcdHRoaXMucXVlc3Rpb25zVmlldy5zZWxlY3RlZFF1ZXN0aW9uLm1vZGVsLmdldChcImlkXCIpID09IHRoaXMucmVzcG9uc2VWaWV3LmFuc3dlci5xdWVzdGlvbklEXG5cdFx0XHQpIHtcblx0XHRcdFx0dGhpcy5yZXNwb25zZVZpZXcuc2hvdygpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdFxuXHRcdHRoaXMucmVzcG9uc2VWaWV3LmdldChcblx0XHRcdHRoaXMucGVvcGxlVmlldy5zZWxlY3RlZFBlcnNvbixcblx0XHRcdHRoaXMucXVlc3Rpb25zVmlldy5zZWxlY3RlZFF1ZXN0aW9uXG5cdFx0KTtcblx0fSxcblx0aGlkZVJlc3BvbnNlOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnJlc3BvbnNlVmlldy5oaWRlKCk7XG5cdFx0VHdlZW5NYXgudG8odGhpcy4kKFwiLmxvd2VyXCIpLCAuNSwge29wYWNpdHk6IDB9KTtcblx0fVxufSk7IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgUGVvcGxlQ29sbGVjdGlvbiA9IHJlcXVpcmUoXCIuLi8uLi9jb2xsZWN0aW9ucy9wZW9wbGVcIik7XG52YXIgUGVyc29uVmlldyA9IHJlcXVpcmUoXCIuL3Blb3BsZS9wZXJzb25cIik7XG5cbm1vZHVsZS5leHBvcnRzID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXHRjbGFzc05hbWU6IFwicGVvcGxlXCIsXG5cdHRhZ05hbWU6IFwidWxcIixcblx0c3dpcGVUaHJlc2hvbGQ6IDEyNSxcblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdFxuXHRcdCQuZ2V0SlNPTihcIi9zY3JpcHRzL2pzb24vcGVvcGxlLmpzXCIsIGZ1bmN0aW9uKGRhdGEpIHtcblx0XHRcdHNlbGYucGVvcGxlQ29sbGVjdGlvbiA9IG5ldyBQZW9wbGVDb2xsZWN0aW9uKGRhdGEpO1xuXHRcdFx0c2VsZi52aWV3cyA9IFtdO1xuXHRcdFx0XG5cdFx0XHQvLyBDcmVhdGUgY3VycmVudCBzZWxlY3RlZCBwZXJzb24gdmlld1xuXHRcdFx0c2VsZi52aWV3cy5wdXNoKG5ldyBQZXJzb25WaWV3KHttb2RlbDogc2VsZi5wZW9wbGVDb2xsZWN0aW9uLmZpcnN0KCl9KSk7XG5cdFx0XHRcblx0XHRcdC8vIFNldCBzZWxlY3RlZCBwZXJzb24gdG8gY2VudGVyXG5cdFx0XHRzZWxmLnNldFNlbGVjdGVkUGVyc29uKHNlbGYudmlld3NbMF0pO1xuXHRcdFx0XG5cdFx0XHQvLyBEcmF3IHBlb3BsZVxuXHRcdFx0c2VsZi5yZW5kZXIoKTtcblx0XHR9KTtcblx0fSxcblx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHQvLyBBZGQgc2VsZWN0ZWQgcGVyc29uXG5cdFx0dGhpcy4kZWwuaHRtbCh0aGlzLnZpZXdzWzBdLmVsKTtcblxuXHRcdC8vIEFkZCB0aGUgb3RoZXJzIGFyb3VuZFxuXHRcdHRoaXMucGFkKCk7XG5cdFx0XG5cdFx0Ly8gU2V0IGVuZGluZyBwb3NpdGlvblxuXHRcdHRoaXMucG9zaXRpb25MZWZ0ID0gLTExOTY7XG5cblx0XHRyZXR1cm4gc2VsZjtcblx0fSxcblx0c2V0U2VsZWN0ZWRQZXJzb246IGZ1bmN0aW9uKHZpZXcpIHtcblx0XHQvLyBUdXJuIG9mZiBjdXJyZW50IHNlbGVjdGVkIHBlcnNvblxuXHRcdGlmKHRoaXMuc2VsZWN0ZWRQZXJzb24pIHtcblx0XHRcdHRoaXMuc2VsZWN0ZWRQZXJzb24uc2VsZWN0ZWQgPSBmYWxzZTtcblx0XHR9XG5cdFx0XG5cdFx0dGhpcy5zZWxlY3RlZFBlcnNvbiA9IHZpZXc7XG5cdFx0dmlldy5zZWxlY3RlZCA9IHRydWU7XG5cdH0sXG5cdHBhZDogZnVuY3Rpb24oKSB7XG5cdFx0Ly8gUGFkcyB0byA1IGVsZW1lbnRzIHRvdGFsLCBhcm91bmQgdGhlIHNlbGVjdGVkIHBlcnNvblxuXHRcdFxuXHRcdC8vIEdldCBsb2NhdGlvbiBpbiB2aWV3cyBvZiBzZWxlY3RlZCBwZXJzb25cblx0XHR2YXIgaW5kZXhPZlNlbGVjdGVkUGVyc29uID0gdGhpcy52aWV3cy5pbmRleE9mKHRoaXMuc2VsZWN0ZWRQZXJzb24pO1xuXHRcdHZhciBtb2RlbEluZGV4LCBtb2RlbCwgdmlldztcblx0XHRcblx0XHQvLyBHZW5lcmF0ZSBhbmQgYWRkIHZpZXdzIGJlZm9yZSB0aGUgc2VsZWN0ZWQgcGVyc29uXG5cdFx0d2hpbGUoaW5kZXhPZlNlbGVjdGVkUGVyc29uIDwgMikge1xuXHRcdFx0Ly8gR2V0IGluZGV4IG9mIGZpcnN0IHZpZXdcblx0XHRcdG1vZGVsSW5kZXggPSB0aGlzLnBlb3BsZUNvbGxlY3Rpb24uaW5kZXhPZih0aGlzLnZpZXdzWzBdLm1vZGVsKTtcblx0XHRcdFxuXHRcdFx0Ly8gRGV0ZXJtaW5lIHdoaWNoIG1vZGVsIHRvIHVzZVxuXHRcdFx0aWYobW9kZWxJbmRleCA9PT0gMCkge1xuXHRcdFx0XHRtb2RlbCA9ICB0aGlzLnBlb3BsZUNvbGxlY3Rpb24ubGFzdCgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bW9kZWwgPSB0aGlzLnBlb3BsZUNvbGxlY3Rpb24uYXQobW9kZWxJbmRleCAtIDEpO1xuXHRcdFx0fVxuXG5cdFx0XHR2aWV3ID0gbmV3IFBlcnNvblZpZXcoe21vZGVsOiBtb2RlbH0pO1xuXHRcdFx0dGhpcy52aWV3cy51bnNoaWZ0KHZpZXcpO1xuXHRcdFx0dGhpcy4kZWwucHJlcGVuZCh2aWV3LmVsKTtcblx0XHRcdFxuXHRcdFx0aW5kZXhPZlNlbGVjdGVkUGVyc29uID0gdGhpcy52aWV3cy5pbmRleE9mKHRoaXMuc2VsZWN0ZWRQZXJzb24pO1xuXHRcdH1cblx0XHRcblx0XHRcblx0XHQvLyBBZGQgdmlld3MgZm9yIGFmdGVyIHRoZSBzZWxlY3RlZCBwZXJzb25cblx0XHR3aGlsZSh0aGlzLnZpZXdzLmxlbmd0aCA8IDUpIHtcblx0XHRcdC8vIEdldCBpbmRleCBvZiBsYXN0IHZpZXdcblx0XHRcdG1vZGVsSW5kZXggPSB0aGlzLnBlb3BsZUNvbGxlY3Rpb24uaW5kZXhPZihfLmxhc3QodGhpcy52aWV3cykubW9kZWwpO1xuXHRcdFx0XG5cdFx0XHQvLyBEZXRlcm1pbmUgd2hpY2ggbW9kZWwgdG8gdXNlXG5cdFx0XHRpZihtb2RlbEluZGV4ID09IF8uc2l6ZSh0aGlzLnBlb3BsZUNvbGxlY3Rpb24pIC0gMSkge1xuXHRcdFx0XHRtb2RlbCA9ICB0aGlzLnBlb3BsZUNvbGxlY3Rpb24uZmlyc3QoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1vZGVsID0gdGhpcy5wZW9wbGVDb2xsZWN0aW9uLmF0KG1vZGVsSW5kZXggKyAxKTtcblx0XHRcdH1cblxuXHRcdFx0dmlldyA9IG5ldyBQZXJzb25WaWV3KHttb2RlbDogbW9kZWx9KTtcblx0XHRcdHRoaXMudmlld3MucHVzaCh2aWV3KTtcblx0XHRcdHRoaXMuJGVsLmFwcGVuZCh2aWV3LmVsKTtcblx0XHR9XG5cdH0sXG5cdHBhbkhhbmRsZXI6IGZ1bmN0aW9uKGUpIHtcblx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0XHRpZihlLm9yaWdpbmFsRXZlbnQuZ2VzdHVyZS5pc0ZpbmFsKSB7XG5cdFx0XHQvLyBGaXJlIGV2ZW50IHRvIHBhcmVudCBpZiBzd2lwZSwgb3RoZXJ3aXNlIHNuYXAgYmFja1xuXHRcdFx0aWYoXG5cdFx0XHRcdGUub3JpZ2luYWxFdmVudC5nZXN0dXJlLmRlbHRhWCA8IC1zZWxmLnN3aXBlVGhyZXNob2xkIHx8XG5cdFx0XHRcdGUub3JpZ2luYWxFdmVudC5nZXN0dXJlLmRlbHRhWCA+IHNlbGYuc3dpcGVUaHJlc2hvbGQpXG5cdFx0XHR7XG5cdFx0XHRcdHNlbGYuJGVsLnRyaWdnZXIoXCJzd2lwZWRcIiwge2V2ZW50OiBlfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRUd2Vlbk1heC50byhzZWxmLiRlbCwgLjEsIHtsZWZ0OiBzZWxmLnBvc2l0aW9uTGVmdH0pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBGaW5kIG5ldyBwb3NpdGlvbiBhbmQgbW92ZVxuXHRcdFx0dmFyIGxlZnQgPSBzZWxmLnBvc2l0aW9uTGVmdCArIGUub3JpZ2luYWxFdmVudC5nZXN0dXJlLmRlbHRhWDtcblx0XHRcdHNlbGYuJGVsLmNzcyh7bGVmdDogbGVmdH0pO1xuXHRcdH1cblx0fSxcblx0c3dpcGVIYW5kbGVyOiBmdW5jdGlvbihlKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdHZhciBjdXJyZW50SW5kZXggPSBzZWxmLnZpZXdzLmluZGV4T2Yoc2VsZi5zZWxlY3RlZFBlcnNvbik7XG5cdFx0XG5cdFx0Ly8gRGV0ZXJtaW5lIHN3aXBlIGRpcmVjdGlvblxuXHRcdGlmKGUub3JpZ2luYWxFdmVudC5nZXN0dXJlLmRlbHRhWCA8IDApIHtcblx0XHRcdC8vIFNldCB0byBmb3J3YXJkIG9uZVxuXHRcdFx0c2VsZi5zZXRTZWxlY3RlZFBlcnNvbihzZWxmLnZpZXdzW2N1cnJlbnRJbmRleCArIDFdKTtcblx0XHRcdFxuXHRcdFx0Ly8gQW5pbWF0ZSB0byBjb3JyZWN0IHBvc2l0aW9uXG5cdFx0XHRUd2Vlbk1heC50byhzZWxmLiRlbCwgLjEsIHtcblx0XHRcdFx0bGVmdDogc2VsZi5wb3NpdGlvbkxlZnQgLSA2NDAsXG5cdFx0XHRcdG9uQ29tcGxldGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdC8vIFJlbW92ZSBhbGwgYXNwZWN0cyBvZiBlZGdlIHZpZXdcblx0XHRcdFx0XHRfLmZpcnN0KHNlbGYudmlld3MpLnJlbW92ZSgpO1xuXHRcdFx0XHRcdHNlbGYudmlld3Muc2hpZnQoKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvLyBBZGQgaW4gbmV3XG5cdFx0XHRcdFx0c2VsZi5wYWQoKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvLyBSZXNldCBtYXJnaW5zXG5cdFx0XHRcdFx0c2VsZi4kKFwiPiBsaTpmaXJzdC1jaGlsZFwiKS5jc3Moe21hcmdpbkxlZnQ6IDB9KTtcblx0XHRcdFx0XHRzZWxmLiQoXCI+IGxpOm50aC1jaGlsZChuICsgMilcIikuY3NzKHttYXJnaW5MZWZ0OiBcIjQwcHhcIn0pO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vIEFkanVzdCBwb3NpdGlvbmluZ1xuXHRcdFx0XHRcdHNlbGYuJGVsLmNzcyh7bGVmdDogc2VsZi5wb3NpdGlvbkxlZnR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIFNldCB0byBiYWNrIG9uZVxuXHRcdFx0c2VsZi5zZXRTZWxlY3RlZFBlcnNvbihzZWxmLnZpZXdzW2N1cnJlbnRJbmRleCAtIDFdKTtcblx0XHRcdFxuXHRcdFx0Ly8gQW5pbWF0ZSB0byBjb3JyZWN0IHBvc2l0aW9uXG5cdFx0XHRUd2Vlbk1heC50byhzZWxmLiRlbCwgLjEsIHtcblx0XHRcdFx0bGVmdDogc2VsZi5wb3NpdGlvbkxlZnQgKyA2NDAsXG5cdFx0XHRcdG9uQ29tcGxldGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0Ly8gUmVtb3ZlIGFsbCBhc3BlY3RzIG9mIGVkZ2Ugdmlld1xuXHRcdFx0XHRcdF8ubGFzdChzZWxmLnZpZXdzKS5yZW1vdmUoKTtcblx0XHRcdFx0XHRzZWxmLnZpZXdzLnBvcCgpO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vIEFkZCBpbiBuZXdcblx0XHRcdFx0XHRzZWxmLnBhZCgpO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vIFJlc2V0IG1hcmdpbnNcblx0XHRcdFx0XHRzZWxmLiQoXCI+IGxpOmZpcnN0LWNoaWxkXCIpLmNzcyh7bWFyZ2luTGVmdDogMH0pO1xuXHRcdFx0XHRcdHNlbGYuJChcIj4gbGk6bnRoLWNoaWxkKG4gKyAyKVwiKS5jc3Moe21hcmdpbkxlZnQ6IFwiNDBweFwifSk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly8gQWRqdXN0IHBvc2l0aW9uaW5nXG5cdFx0XHRcdFx0c2VsZi4kZWwuY3NzKHtsZWZ0OiBzZWxmLnBvc2l0aW9uTGVmdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cbn0pOyIsIlwidXNlIHN0cmljdFwiO1xubW9kdWxlLmV4cG9ydHMgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cdHRhZ05hbWU6IFwibGlcIixcblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdFxuXHRcdCQuZ2V0KFwiL3RlbXBsYXRlcy9jb252ZXJzYXRpb24vcGVvcGxlL3BlcnNvbi5odG1sXCIsIGZ1bmN0aW9uKGRhdGEpIHtcblx0XHRcdHNlbGYudGVtcGxhdGUgPSBfLnRlbXBsYXRlKGRhdGEpO1xuXHRcdFx0c2VsZi5yZW5kZXIoKTtcblx0XHR9KTtcblx0XHRcblx0XHQkLmdldChcIi90ZW1wbGF0ZXMvY29udmVyc2F0aW9uL3Blb3BsZS9wZXJzb24vbW9kYWwuaHRtbFwiLCBmdW5jdGlvbihkYXRhKSB7XG5cdFx0XHRzZWxmLm1vZGFsVGVtcGxhdGUgPSBfLnRlbXBsYXRlKGRhdGEpO1xuXHRcdH0pO1xuXHR9LFxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuJGVsLmh0bWwodGhpcy50ZW1wbGF0ZSh0aGlzLm1vZGVsLnRvSlNPTigpKSk7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cdGV2ZW50czoge1xuXHRcdFwiY2xpY2sgLnBpY3R1cmVcIjogXCJwb3B1cEhhbmRsZXJcIixcblx0XHRcImNsaWNrIC5zb3VyY2VzIGxpXCI6IFwicG9wdXBIYW5kbGVyXCIsXG5cdFx0XCJjbGljayAucG9wdXAgYnV0dG9uXCI6IFwicmVwb3J0VG9nZ2xlclwiLFxuXHRcdFwiY2xpY2sgLm1vZGFsIGJ1dHRvblwiOiBcInJlcG9ydFRvZ2dsZXJcIlxuXHR9LFxuXHRyZXBvcnRUb2dnbGVyOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgJG1vZGFsID0gdGhpcy4kZWwuZmluZChcIi5tb2RhbFwiKTtcblx0XHRcblx0XHQvLyBDcmVhdGUgbW9kYWwgaWYgbmVlZGVkLCBvdGhlcndpc2UgcmVtb3ZlXG5cdFx0aWYoISRtb2RhbC5sZW5ndGgpIHtcblx0XHRcdHRoaXMuJGVsLmFwcGVuZCh0aGlzLm1vZGFsVGVtcGxhdGUodGhpcy5tb2RlbC50b0pTT04oKSkpO1xuXHRcdFx0JG1vZGFsID0gdGhpcy4kKFwiLm1vZGFsXCIpO1xuXHRcdFx0XG5cdFx0XHQkbW9kYWwud2FpdEZvckltYWdlcyhmdW5jdGlvbigpIHtcblx0XHRcdFx0JG1vZGFsLnJlbW92ZUNsYXNzKFwic3Bpbm5lclwiKS5hZGRDbGFzcyhcInNwaW5PdXRcIik7XG5cdFx0XHRcdFR3ZWVuTWF4LmZyb21UbygkbW9kYWwuZmluZChcIj4gZGl2XCIpLCAuNSxcblx0XHRcdFx0XHR7b3BhY2l0eTogMCwgdmlzaWJpbGl0eTogXCJ2aXNpYmxlXCJ9LFxuXHRcdFx0XHRcdHtvcGFjaXR5OiAxLCBvbkNvbXBsZXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdCRtb2RhbC5yZW1vdmVDbGFzcyhcInNwaW5PdXRcIik7XG5cdFx0XHRcdFx0fX1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXG5cdFx0XHQvLyBQcmV2ZW50IGJhY2tncm91bmQgY2xpY2tzXG5cdFx0XHQkbW9kYWwub24oXCJ0b3VjaHN0YXJ0IG1vdXNlZG93biBjbGlja1wiLCBmdW5jdGlvbihlKSB7XG5cdFx0XHRcdGlmKCEkKGUudGFyZ2V0KS5pcygkbW9kYWwuZmluZChcImJ1dHRvblwiKSkpIHtcblx0XHRcdFx0XHRlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0VHdlZW5NYXgudG8oJG1vZGFsLCAuNSwge29wYWNpdHk6IDAsIG9uQ29tcGxldGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHQkbW9kYWwucmVtb3ZlKCk7XG5cdFx0XHR9fSk7XG5cdFx0fVxuXHR9LFxuXHRvYnRhaW5EYXRhOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cdFx0XG5cdFx0c2VsZi4kKFwibGkuYXZhaWxhYmxlXCIpLmVhY2goZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKHRoaXMpO1xuXHRcdFx0XG5cdFx0XHQkdGhpcy5yZW1vdmVDbGFzcyhcInNwaW5PdXRcIikuYWRkQ2xhc3MoXCJzcGlubmVyXCIpO1xuXG5cdFx0XHQvLyBEYXRhIG9idGFpbmVkIGFmdGVyIHJhbmRvbSB0aW1lXG5cdFx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHQkdGhpcy5yZW1vdmVDbGFzcyhcInNwaW5uZXJcIikuYWRkQ2xhc3MoXCJzcGluT3V0XCIpO1xuXHRcdFx0fSwgTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMjAwMCArIDEwMDApKTtcblx0XHR9KTtcblx0XHRcblx0XHQvLyBTaWduYWwgdG8gcGFyZW50IGRhdGEgaXMgcmVhZHlcblx0XHRzZWxmLiRlbC50cmlnZ2VyKFwiZGF0YVNvdXJjZWRcIik7XG5cdH0sXG5cdHBvcHVwSGFuZGxlcjogZnVuY3Rpb24oZSkge1xuXHRcdC8vIENoZWNrIGlmIGN1cnJlbnQgcGVyc29uIGJlaW5nIGNsaWNrZWQgb25cblx0XHRpZih0aGlzLnNlbGVjdGVkKSB7XG5cdFx0XHRlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdFx0dmFyICRuZXdQb3B1cCA9ICQoZS50YXJnZXQpLnNpYmxpbmdzKFwiLnBvcHVwXCIpO1xuXHRcdFx0XG5cdFx0XHRpZighc2VsZi4kcG9wdXApIHtcblx0XHRcdFx0dGhpcy5wb3B1cFNob3dlcigkbmV3UG9wdXApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dmFyIGlzU2FtZUFzQ3VycmVudCA9IHNlbGYuJHBvcHVwLmlzKCRuZXdQb3B1cCk7XG5cblx0XHRcdFx0Ly8gSGlkZSBjdXJyZW50IHBvcHVwXG5cdFx0XHRcdHRoaXMucG9wdXBSZW1vdmVyKHNlbGYuJHBvcHVwKTtcblx0XHRcdFx0XG5cdFx0XHRcdGlmKCFpc1NhbWVBc0N1cnJlbnQpIHtcblx0XHRcdFx0XHQvLyBTaG93IG5ld1xuXHRcdFx0XHRcdHNlbGYuJHBvcHVwID0gJG5ld1BvcHVwO1xuXHRcdFx0XHRcdHRoaXMucG9wdXBTaG93ZXIoc2VsZi4kcG9wdXApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXHRwb3B1cFJlbW92ZXI6IGZ1bmN0aW9uKCRwKSB7XG5cdFx0dGhpcy4kcG9wdXAgPSBudWxsO1xuXHRcdFxuXHRcdC8vIEZhZGUgYW5kIGhpZGUgcG9wdXBcblx0XHRUd2Vlbk1heC50bygkcCwgLjUsIHtcblx0XHRcdG9wYWNpdHk6IDAsXG5cdFx0XHRkaXNwbGF5OiBcIm5vbmVcIixcblx0XHRcdG92ZXJ3cml0ZTogXCJhbGxcIlxuXHRcdH0pO1xuXG5cdFx0Ly8gVHVybiBvZmYgbGlzdGVuZXJcblx0XHQkKFwiYm9keVwiKS5vZmYoXCJ0b3VjaGVuZCBjbGlja1wiKTtcblx0fSxcblx0cG9wdXBTaG93ZXI6IGZ1bmN0aW9uKCRwKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdFxuXHRcdHNlbGYuJHBvcHVwID0gJHA7XG5cdFx0XG5cdFx0Ly8gU2hvdyBhbmQgZmFkZSBpblxuXHRcdFR3ZWVuTWF4LmZyb21UbygkcCwgLjUsXG5cdFx0XHR7b3BhY2l0eTogMCwgZGlzcGxheTogXCJibG9ja1wifSxcblx0XHRcdHtvcGFjaXR5OiAxLCBvdmVyd3JpdGU6IFwiYWxsXCJ9XG5cdFx0KTtcblx0XHRcblx0XHQvLyBMaXN0ZW4gZm9yIGFueXRoaW5nIHRvIHR1cm4gb2ZmXG5cdFx0JChcImJvZHlcIikub25lKFwidG91Y2hlbmQgY2xpY2tcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHRzZWxmLnBvcHVwUmVtb3ZlcigkcCk7XG5cdFx0fSk7XG5cdH1cbn0pOyIsIlwidXNlIHN0cmljdFwiO1xudmFyIFF1ZXN0aW9uTW9kZWwgPSByZXF1aXJlKFwiLi4vLi4vbW9kZWxzL3F1ZXN0aW9uXCIpO1xudmFyIFF1ZXN0aW9uc0NvbGxlY3Rpb24gPSByZXF1aXJlKFwiLi4vLi4vY29sbGVjdGlvbnMvcXVlc3Rpb25zXCIpO1xudmFyIFF1ZXN0aW9uVmlldyA9IHJlcXVpcmUoXCIuL3F1ZXN0aW9ucy9xdWVzdGlvblwiKTtcbnZhciBDdXN0b21RdWVzdGlvblZpZXcgPSByZXF1aXJlKFwiLi9xdWVzdGlvbnMvY3VzdG9tUXVlc3Rpb25cIik7XG5cbm1vZHVsZS5leHBvcnRzID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXHRjbGFzc05hbWU6IFwicXVlc3Rpb25zXCIsXG5cdHRhZ05hbWU6IFwidWxcIixcblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdFxuXHRcdCQuZ2V0SlNPTihcIi9zY3JpcHRzL2pzb24vcXVlc3Rpb25zLmpzXCIsIGZ1bmN0aW9uKGRhdGEpIHtcblx0XHRcdHNlbGYucXVlc3Rpb25zQ29sbGVjdGlvbiA9IG5ldyBRdWVzdGlvbnNDb2xsZWN0aW9uKGRhdGEpO1xuXHRcdFx0c2VsZi52aWV3cyA9IFtdO1xuXG5cdFx0XHQvLyBDcmVhdGUgcXVlc3Rpb24gdmlld3Ncblx0XHRcdHNlbGYucXVlc3Rpb25zQ29sbGVjdGlvbi5lYWNoKGZ1bmN0aW9uKG1vZGVsKSB7XG5cdFx0XHRcdHNlbGYudmlld3MucHVzaChuZXcgUXVlc3Rpb25WaWV3KHttb2RlbDogbW9kZWx9KSk7XG5cdFx0XHR9KTtcblx0XHRcdFxuXHRcdFx0Ly8gQWRkIGluIGN1c3RvbSBxdWVzdGlvblxuXHRcdFx0c2VsZi52aWV3cy5wdXNoKG5ldyBDdXN0b21RdWVzdGlvblZpZXcoe1xuXHRcdFx0XHRtb2RlbDogbmV3IFF1ZXN0aW9uTW9kZWwoKVxuXHRcdFx0fSkpO1xuXHRcdFx0XG5cdFx0XHRzZWxmLnJlbmRlcigpO1xuXHRcdH0pO1xuXHR9LFxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBzZWxmID0gdGhpcztcblx0XHRcblx0XHRzZWxmLiRlbC5lbXB0eSgpO1xuXHRcdFxuXHRcdHZhciBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cdFx0XG5cdFx0Ly8gUmVuZGVyIGVhY2ggcXVlc3Rpb24gYW5kIGFkZCBhdCBlbmRcblx0XHRfLmVhY2goc2VsZi52aWV3cywgZnVuY3Rpb24odmlldykge1xuXHRcdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHZpZXcuZWwpO1xuXHRcdH0pO1xuXHRcdFxuXHRcdHNlbGYuJGVsLmFwcGVuZChjb250YWluZXIpO1xuXHRcdFxuXHRcdHJldHVybiBzZWxmO1xuXHR9LFxuXHRldmVudHM6IHtcblx0XHRcInF1ZXN0aW9uQ2xpY2tlZFwiOiBcInF1ZXN0aW9uQ2xpY2tlZFwiLFxuXHRcdFwicmVnZW5lcmF0ZUN1c3RvbVF1ZXN0aW9uXCI6IFwicmVnZW5lcmF0ZUN1c3RvbVF1ZXN0aW9uXCJcblx0fSxcblx0cXVlc3Rpb25DbGlja2VkOiBmdW5jdGlvbihldmVudCwgb2JqZWN0cykge1xuXHRcdGlmKCF0aGlzLnNlbGVjdGVkUXVlc3Rpb24pIHtcblx0XHRcdC8vIFNhdmUgdmlldyBhbmQgaGlkZSBvdGhlcnNcblx0XHRcdHRoaXMuc2VsZWN0ZWRRdWVzdGlvbiA9IG9iamVjdHMuc2VsZWN0ZWRRdWVzdGlvbjtcblx0XHRcdHRoaXMuaGlkZUFsbEV4Y2VwdFNlbGVjdGVkUXVlc3Rpb24oKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy4kZWwudHJpZ2dlcihcInJldmVhbEFsbFF1ZXN0aW9uc1wiKTtcblx0XHR9XG5cdH0sXG5cdGhpZGVBbGxFeGNlcHRTZWxlY3RlZFF1ZXN0aW9uOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cdFx0XG5cdFx0Ly8gQnViYmxlIHVwIHRoZSBldmVudFxuXHRcdHNlbGYuJGVsLnRyaWdnZXIoXCJoaWRBbGxFeGNlcHRTZWxlY3RlZFF1ZXN0aW9uXCIpO1xuXHRcdFxuXHRcdF8uZWFjaCh0aGlzLnZpZXdzLCBmdW5jdGlvbih2aWV3KSB7XG5cdFx0XHRpZih2aWV3ID09IHNlbGYuc2VsZWN0ZWRRdWVzdGlvbikge1xuXHRcdFx0XHQvLyBTYXZlIGN1cnJlbnQgb2Zmc2V0XG5cdFx0XHRcdHZhciBjdXJyZW50T2Zmc2V0ID0gdmlldy4kZWwub2Zmc2V0KCk7XG5cdFx0XHRcdFxuXHRcdFx0XHR2aWV3LiRlbC5jc3MoXCJwb3NpdGlvblwiLCBcImFic29sdXRlXCIpO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly8gU2F2ZSBkZXNpcmVkIG9mZnNldFxuXHRcdFx0XHR2YXIgZGVzaXJlZE9mZnNldCA9IHZpZXcuJGVsLm9mZnNldCgpO1xuXHRcdFx0XHRcblx0XHRcdFx0dmlldy4kZWwuY3NzKFwicG9zaXRpb25cIiwgXCJyZWxhdGl2ZVwiKTtcblx0XHRcdFx0XG5cdFx0XHRcdC8vIFJlc2V0IHBvc2l0aW9uaW5nIGFuZCBtb3ZlIHF1ZXN0aW9uXG5cdFx0XHRcdFR3ZWVuTWF4LnRvKHZpZXcuJGVsLCAuNSwge1xuXHRcdFx0XHRcdHRvcDogZGVzaXJlZE9mZnNldC50b3AgLSBjdXJyZW50T2Zmc2V0LnRvcFxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIEhpZGUgYWxsIG90aGVyIHF1ZXN0aW9uc1xuXHRcdFx0XHRUd2Vlbk1heC50byh2aWV3LiRlbCwgLjUsIHthdXRvQWxwaGE6IDB9KTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSxcblx0cmV2ZWFsQWxsUXVlc3Rpb25zOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cdFx0XG5cdFx0aWYoc2VsZi5zZWxlY3RlZFF1ZXN0aW9uKSB7XG5cdFx0XHQvLyBCdWJibGUgdXAgdGhlIGV2ZW50XG5cdFx0XHRzZWxmLiRlbC50cmlnZ2VyKFwicmV2ZWFsZWRBbGxRdWVzdGlvbnNcIik7XG5cdFx0XHRcblx0XHRcdF8uZWFjaCh0aGlzLnZpZXdzLCBmdW5jdGlvbih2aWV3KSB7XG5cdFx0XHRcdC8vIFJlc2V0IGN1c3RvbSBxdWVzdGlvblxuXHRcdFx0XHRpZih2aWV3IGluc3RhbmNlb2YgQ3VzdG9tUXVlc3Rpb25WaWV3KSB7XG5cdFx0XHRcdFx0dmlldy5zdGFsZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHRpZih2aWV3ID09IHNlbGYuc2VsZWN0ZWRRdWVzdGlvbikge1xuXHRcdFx0XHRcdHNlbGYuc2VsZWN0ZWRRdWVzdGlvbiA9IG51bGw7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly8gQW5pbWF0ZSBiYWNrIHRvIHBvc2l0aW9uLCBpZiBuZWVkZWRcblx0XHRcdFx0XHRpZighdmlldy4kZWwuaXMoXCI6Zmlyc3QtY2hpbGRcIikpIHtcblx0XHRcdFx0XHRcdFR3ZWVuTWF4LnRvKHZpZXcuJGVsLCAuNSwge1xuXHRcdFx0XHRcdFx0XHR0b3A6IDAsXG5cdFx0XHRcdFx0XHRcdG9uQ29tcGxldGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0XHRcdGlmKHZpZXcgaW5zdGFuY2VvZiBDdXN0b21RdWVzdGlvblZpZXcpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHNlbGYucmVnZW5lcmF0ZUN1c3RvbVF1ZXN0aW9uKCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gUmV2ZWFsIG90aGVyIHF1ZXN0aW9uc1xuXHRcdFx0XHRcdFR3ZWVuTWF4LnRvKHZpZXcuJGVsLCAuNSwge2F1dG9BbHBoYTogMX0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH0sXG5cdHJlZ2VuZXJhdGVDdXN0b21RdWVzdGlvbjogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdFxuXHRcdC8vIEJyaW5nIGN1cnJlbnQgb3V0IG9mIHBvc2l0aW9uXG5cdFx0dmFyIGN1cnJlbnQgPSBzZWxmLnZpZXdzLnNsaWNlKC0xKVswXTtcblx0XHRjdXJyZW50LiRlbC5jc3Moe1xuXHRcdFx0cG9zaXRpb246IFwiYWJzb2x1dGVcIixcblx0XHRcdHRvcDogY3VycmVudC4kZWwucG9zaXRpb24oKS50b3AsXG5cdFx0XHRsZWZ0OiBjdXJyZW50LiRlbC5wb3NpdGlvbigpLmxlZnQsXG5cdFx0XHR3aWR0aDogY3VycmVudC4kZWwub3V0ZXJXaWR0aCgpLFxuXHRcdFx0ekluZGV4OiAxMFxuXHRcdH0pO1xuXHRcdFxuXHRcdC8vIEFkZCBpbiBuZXcgb25lXG5cdFx0dmFyIHZpZXcgPSBuZXcgQ3VzdG9tUXVlc3Rpb25WaWV3KHttb2RlbDogbmV3IFF1ZXN0aW9uTW9kZWwoKX0pO1xuXHRcdHNlbGYuJGVsLmFwcGVuZCh2aWV3LmVsKTtcblx0XHRcblx0XHQvLyBSZW1vdmUgb2xkIHdoZW4gbmV3IHByZXNlbnRcblx0XHR2YXIgaSA9IHNldEludGVydmFsKGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYoalF1ZXJ5LmNvbnRhaW5zKHNlbGYuZWwsIHZpZXcuZWwpKSB7XG5cdFx0XHRcdGNsZWFySW50ZXJ2YWwoaSk7XG5cdFx0XHRcdFxuXHRcdFx0XHRjdXJyZW50LnJlbW92ZSgpO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly8gQ2xlYW51cCBhcnJheVxuXHRcdFx0XHRzZWxmLnZpZXdzLnBvcCgpO1xuXHRcdFx0XHRzZWxmLnZpZXdzLnB1c2godmlldyk7XG5cdFx0XHR9XG5cdFx0fSwgMSk7XG5cdH1cbn0pOyIsIlwidXNlIHN0cmljdFwiO1xubW9kdWxlLmV4cG9ydHMgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cdHRhZ05hbWU6IFwibGlcIixcblx0Y2xhc3NOYW1lOiBcImN1c3RvbVwiLFxuXHRzdGF0dXM6IFwic3RhbGVcIixcblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fSxcblx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cdFx0XG5cdFx0JC5nZXQoXCIvdGVtcGxhdGVzL2NvbnZlcnNhdGlvbi9xdWVzdGlvbnMvY3VzdG9tLmh0bWxcIiwgZnVuY3Rpb24oZGF0YSkge1xuXHRcdFx0c2VsZi4kZWwuYXBwZW5kKGRhdGEpO1xuXHRcdFx0c2VsZi4kaW5wdXQgPSBzZWxmLiQoXCJpbnB1dFwiKTtcblx0XHRcdHNlbGYuJGJ1dHRvbiA9IHNlbGYuJChcImJ1dHRvblwiKTtcblx0XHRcdHNlbGYuJGJ1dHRvbi5jc3MoXCJkaXNwbGF5XCIsIFwibm9uZVwiKTtcblx0XHR9KTtcblx0XHRcblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblx0ZXZlbnRzOiB7XG5cdFx0XCJjbGlja1wiOiBcInJvdXRlclwiLFxuXHRcdFwia2V5dXAgaW5wdXRcIjogXCJrZXlIYW5kbGVyXCJcblx0fSxcblx0cm91dGVyOiBmdW5jdGlvbihlKSB7XG5cdFx0aWYoJChlLnRhcmdldCkuaXModGhpcy4kYnV0dG9uKSAmJiB0aGlzLiRpbnB1dC52YWwoKSAhPT0gXCJcIikge1xuXHRcdFx0dGhpcy5zZWxlY3RlZCgpO1xuXHRcdH0gZWxzZSBpZih0aGlzLnN0YXR1cyA9PSBcInNlbGVjdGVkXCIpIHtcblx0XHRcdHRoaXMuJGVsLnRyaWdnZXIoXCJxdWVzdGlvbkNsaWNrZWRcIiwge3NlbGVjdGVkUXVlc3Rpb246IHRoaXN9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5lZGl0aW5nKCk7XG5cdFx0fVxuXHR9LFxuXHRrZXlIYW5kbGVyOiBmdW5jdGlvbihlKSB7XG5cdFx0aWYoZS5rZXlDb2RlID09IDEzKXtcblx0XHRcdHRoaXMuJGJ1dHRvbi5jbGljaygpO1xuXHRcdH1cblx0fSxcblx0ZWRpdGluZzogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdFxuXHRcdHNlbGYuc3RhdHVzID0gXCJlZGl0aW5nXCI7XG5cdFx0XG5cdFx0Ly8gQWxsb3cgZWRpdGluZ1xuXHRcdHNlbGYuJGlucHV0LnByb3AoXCJyZWFkb25seVwiLCBmYWxzZSkuZm9jdXMoKTtcblx0XHRcblx0XHQvLyBBbmltYXRlIGlmIG5vdCBhbHJlYWR5IGRvbmVcblx0XHRpZighc2VsZi4kZWwuaGFzQ2xhc3MoXCJmb2N1c2VkXCIpKSB7XG5cdFx0XHRUd2Vlbk1heC50byhzZWxmLiRlbCwgLjUsIHtjbGFzc05hbWU6IFwiKz1mb2N1c2VkXCJ9KTtcblx0XHRcdFxuXHRcdFx0VHdlZW5NYXguZnJvbVRvKHNlbGYuJGJ1dHRvbiwgLjUsXG5cdFx0XHRcdHtvcGFjaXR5OiAwLCBkaXNwbGF5OiBcImJsb2NrXCJ9LFxuXHRcdFx0XHR7b3BhY2l0eTogMX1cblx0XHRcdCk7XG5cdFx0fVxuXHR9LFxuXHRzZWxlY3RlZDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdFxuXHRcdHNlbGYuc3RhdHVzID0gXCJzZWxlY3RlZFwiO1xuXHRcdFxuXHRcdC8vIFNhdmUgZGF0YSB0byBtb29kZWxcblx0XHRzZWxmLm1vZGVsLnNldCh7XCJ0ZXh0XCI6IHNlbGYuJGlucHV0LnZhbCgpfSk7XG5cdFx0XG5cdFx0Ly8gRGlzYWJsZSBlZGl0aW5nIGFuZCBzaHJpbmtcblx0XHRzZWxmLiRpbnB1dC5ibHVyKCkucHJvcChcInJlYWRvbmx5XCIsIHRydWUpO1xuXHRcdHNlbGYuc2hyaW5rKCk7XG5cblx0XHQvLyBGaXJlIGV2ZW50IHRvIHBhcmVudFxuXHRcdHNlbGYuJGVsLnRyaWdnZXIoXCJxdWVzdGlvbkNsaWNrZWRcIiwge3NlbGVjdGVkUXVlc3Rpb246IHNlbGZ9KTtcblx0fSxcblx0c3RhbGU6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuJGlucHV0LnZhbChcIlwiKTtcblx0XHRcblx0XHRpZih0aGlzLnN0YXR1cyA9PSBcImVkaXRpbmdcIikge1xuXHRcdFx0dGhpcy5zaHJpbmsoKTtcblx0XHR9XG5cdFx0XG5cdFx0dGhpcy5zdGF0dXMgPSBcInN0YWxlXCI7XG5cdH0sXG5cdHNocmluazogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdFxuXHRcdFR3ZWVuTWF4LnRvKHNlbGYuJGVsLCAuNSwge2NsYXNzTmFtZTogXCItPWZvY3VzZWRcIn0pO1xuXHRcdFxuXHRcdFR3ZWVuTWF4LnRvKHNlbGYuJGJ1dHRvbiwgLjUsIHtcblx0XHRcdG9wYWNpdHk6IDAsXG5cdFx0XHRkaXNwbGF5OiBcIm5vbmVcIlxuXHRcdH0pO1xuXHR9XG59KTsiLCJcInVzZSBzdHJpY3RcIjtcbm1vZHVsZS5leHBvcnRzID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuXHR0YWdOYW1lOiBcImxpXCIsXG5cdHRlbXBsYXRlOiBfLnRlbXBsYXRlKFwiPCU9IHRleHQgJT5cIiksXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cdH0sXG5cdHJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy4kZWwuaHRtbCh0aGlzLnRlbXBsYXRlKHRoaXMubW9kZWwudG9KU09OKCkpKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblx0ZXZlbnRzOiB7XG5cdFx0XCJjbGlja1wiOiBcImNsaWNrZWRcIlxuXHR9LFxuXHRjbGlja2VkOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLiRlbC50cmlnZ2VyKFwicXVlc3Rpb25DbGlja2VkXCIsIHtzZWxlY3RlZFF1ZXN0aW9uOiB0aGlzfSk7XG5cdH1cbn0pOyIsIlwidXNlIHN0cmljdFwiO1xuLypqc2hpbnQgLVcwODMsIC1XMDA4ICovXG5cbnZhciBjb25maWcgPSByZXF1aXJlKFwiLi4vLi4vLi4vY29uZmlnXCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblx0Y2xhc3NOYW1lOiBcInJlc3BvbnNlXCIsXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBzZWxmID0gdGhpcztcblx0XHRcblx0XHQvLyBMb2FkIGRhdGEgYW5kIHN0YXJ0XG5cdFx0dmFyIGExID0gJC5nZXRKU09OKFwiL3NjcmlwdHMvanNvbi9nZW5lcy5qc1wiKTtcblx0XHR2YXIgYTIgPSAkLmdldEpTT04oXCIvc2NyaXB0cy9qc29uL2Fuc3dlcnMuanNcIik7XG5cdFx0dmFyIGEzID0gJC5nZXQoXCIvdGVtcGxhdGVzL2NvbnZlcnNhdGlvbi9yZXNwb25zZS9nZW5lcy5odG1sXCIpO1xuXHRcdFxuXHRcdCQud2hlbihhMSwgYTIsIGEzKS5kb25lKGZ1bmN0aW9uKHIxLCByMiwgcjMpIHtcblx0XHRcdHNlbGYuZ2VuZXMgPSByMVswXTtcblx0XHRcdHNlbGYuYW5zd2VycyA9IHIyWzBdO1xuXHRcdFx0c2VsZi5nZW5lc1RlbXBsYXRlID0gXy50ZW1wbGF0ZShyM1swXSk7XG5cdFx0XHRzZWxmLnJlbmRlcigpO1xuXHRcdFx0c2VsZi5zZXRUb0xvYWRpbmcoKTtcblx0XHR9KTtcblx0fSxcblx0cmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnNldFRvTG9hZGluZygpO1xuXHRcdHRoaXMuJGVsLmhpZGUoKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblx0ZXZlbnRzOiB7XG5cdFx0XCJjbGljayBmb290ZXIgZGl2Om50aC1sYXN0LWNoaWxkKC1uICsgMilcIjogXCJtYXJrUmF0ZWRcIlxuXHR9LFxuXHRtYXJrUmF0ZWQ6IGZ1bmN0aW9uKGUpIHtcblx0XHQkKGUuY3VycmVudFRhcmdldCkucGFyZW50KCkuZmluZChcImRpdlwiKS5yZW1vdmVDbGFzcyhcImNsaWNrZWRcIik7XG5cdFx0JChlLmN1cnJlbnRUYXJnZXQpLmFkZENsYXNzKFwiY2xpY2tlZFwiKTtcblx0fSxcblx0c2V0VG9Mb2FkaW5nOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLiRlbFxuXHRcdFx0LmVtcHR5KClcblx0XHRcdC5hZGRDbGFzcyhcInNwaW5uZXJcIilcblx0XHRcdC5yZW1vdmVDbGFzcyhcInNwaW5PdXRcIilcblx0XHRcdC5yZW1vdmVDbGFzcyhcImhhcy1tYXBcIilcblx0XHRcdC5yZW1vdmVDbGFzcyhcImhhcy1nZW5lc1wiKVxuXHRcdDtcblx0fSxcblx0cHJlcGFyZTogZnVuY3Rpb24oYW5zd2VyKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdFx0Ly8gQWRqdXN0IHNpemUgb2YgYW5zd2VyIGFyZWEgYmFzZWQgb24gcXVlc3Rpb24gc2l6ZVxuXHRcdHZhciB0b3AgPSBhbnN3ZXIuJGVsLnBhcmVudCgpLm9mZnNldCgpLnRvcCArIDU4ICsgMTA7XG5cdFx0dmFyIGhlaWdodCA9IDUyMCAtIDU4O1xuXHRcdFxuXHRcdHNlbGYuJGVsLmNzcyh7XG5cdFx0XHRkaXNwbGF5OiBcImJsb2NrXCIsXG5cdFx0XHR0b3A6IHRvcCxcblx0XHRcdGhlaWdodDogaGVpZ2h0XG5cdFx0fSk7XG5cdFx0XG5cdFx0Ly8gRmFkZSBpbiByZXNwb25zZVxuXHRcdFR3ZWVuTWF4LmZyb21UbyhzZWxmLiRlbCwgLjUsIHtvcGFjaXR5OiAwfSwge29wYWNpdHk6IDEsIG92ZXJ3cml0ZTogXCJhbGxcIn0pO1xuXHR9LFxuXHRnZXQ6IGZ1bmN0aW9uKHBlcnNvbiwgcXVlc3Rpb24pIHtcblx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cdFx0dmFyIHJlcXVlc3REYXRhO1xuXHRcdHNlbGYuYW5zd2VyID0ge307XG5cdFx0c2VsZi5hbnN3ZXIuY2lkID0gcGVyc29uLmNpZDtcblx0XHRzZWxmLmFuc3dlci5wZXJzb25JRCA9IHBlcnNvbi5tb2RlbC5nZXQoXCJpZFwiKTtcblx0XHRzZWxmLmFuc3dlci5xdWVzdGlvbklEID0gcXVlc3Rpb24ubW9kZWwuZ2V0KFwiaWRcIik7XG5cdFx0c2VsZi5hbnN3ZXIuaHRtbCA9IFwiXCI7XG5cdFx0XG5cdFx0dmFyIG51bWJlcldpdGhDb21tYXMgPSBmdW5jdGlvbih4KSB7XG5cdFx0XHRyZXR1cm4geC50b1N0cmluZygpLnJlcGxhY2UoL1xcQig/PShcXGR7M30pKyg/IVxcZCkpL2csIFwiLFwiKTtcblx0XHR9O1xuXHRcdFxuXHRcdC8vIEdlbmUgbGlzdFxuXHRcdGlmKFsxLCAyLCAzXS5pbmRleE9mKHNlbGYuYW5zd2VyLnF1ZXN0aW9uSUQpID4gLTEpIHtcblx0XHRcdHNlbGYuYW5zd2VyLmdlbmVzID0gc2VsZi5nZW5lc1RlbXBsYXRlKHNlbGYuZ2VuZXNbcXVlc3Rpb24ubW9kZWwuZ2V0KFwiZ2VuZXNcIildKTtcblx0XHR9XG5cdFx0XG5cdFx0Ly8gR2V0IGFuc3dlciBhbmQgbWFwLCBkZXBlbmRpbmcgb24gc3RvcmVkIHJlc3BvbnNlXG5cdFx0aWYoc2VsZi5hbnN3ZXIucXVlc3Rpb25JRCA8IDQpIHtcblx0XHRcdHZhciBodG1sID0gXCJcIjtcblx0XHRcdFxuXHRcdFx0c3dpdGNoKHNlbGYuYW5zd2VyLnF1ZXN0aW9uSUQpIHtcblx0XHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHRcdC8vIEdldCBmaXRuZXNzIGRhdGEgYWJvdXQgcGVyc29uXG5cdFx0XHRcdFx0cmVxdWVzdERhdGEgPSB7XG5cdFx0XHRcdFx0XHRcInVzZXJJZFwiOiBzZWxmLmFuc3dlci5wZXJzb25JRCxcblx0XHRcdFx0XHRcdFwiZml0bmVzc1wiOiBcInRydWVcIlxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly8gR2V0IHRoZSBhbnN3ZXJcblx0XHRcdFx0XHRzZWxmLmpxeGhyID0gJC5hamF4KHtcblx0XHRcdFx0XHRcdHVybDogY29uZmlnLnVybCxcblx0XHRcdFx0XHRcdGRhdGE6IHJlcXVlc3REYXRhLFxuXHRcdFx0XHRcdFx0ZGF0YVR5cGU6IFwianNvbnBcIixcblx0XHRcdFx0XHRcdHRpbWVvdXQ6IDMwMDBcblx0XHRcdFx0XHR9KS5hbHdheXMoZnVuY3Rpb24oZGF0YSwgc3RhdHVzLCBqcXhocikge1xuXHRcdFx0XHRcdFx0aWYoc3RhdHVzID09IFwic3VjY2Vzc1wiICYmIGRhdGEuZml0bmVzcy5jb2RlID09PSAwKSB7XG5cdFx0XHRcdFx0XHRcdHZhciByYW5kb21OdW1iZXIgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiA2KTtcblx0XHRcdFx0XHRcdFx0dmFyIHJhbmRvbVJlc3BvbnNlO1xuXHRcdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdFx0Ly8gR2VuZXJhdGUgcmFuZG9tIHJlc3BvbnNlXG5cdFx0XHRcdFx0XHRcdGlmKHJhbmRvbU51bWJlciAhPSA0KSB7XG5cdFx0XHRcdFx0XHRcdFx0cmFuZG9tUmVzcG9uc2UgPSBzZWxmLmFuc3dlcnNbMF0ucmVzcG9uc2VzW3JhbmRvbU51bWJlcl07XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0cmFuZG9tUmVzcG9uc2UgPVxuXHRcdFx0XHRcdFx0XHRcdFx0c2VsZi5hbnN3ZXJzWzBdLnJlc3BvbnNlc1tyYW5kb21OdW1iZXJdWzBdICtcblx0XHRcdFx0XHRcdFx0XHRcdHNlbGYuYW5zd2Vyc1swXS5sb2NhdGlvbnNbc2VsZi5hbnN3ZXIucGVyc29uSUQgLSAxXS50aXRsZSArXG5cdFx0XHRcdFx0XHRcdFx0XHRzZWxmLmFuc3dlcnNbMF0ucmVzcG9uc2VzW3JhbmRvbU51bWJlcl1bMV0gK1xuXHRcdFx0XHRcdFx0XHRcdFx0c2VsZi5hbnN3ZXJzWzBdLmxvY2F0aW9uc1tzZWxmLmFuc3dlci5wZXJzb25JRCAtIDFdLmFkZHJlc3MgK1xuXHRcdFx0XHRcdFx0XHRcdFx0c2VsZi5hbnN3ZXJzWzBdLnJlc3BvbnNlc1tyYW5kb21OdW1iZXJdWzJdXG5cdFx0XHRcdFx0XHRcdFx0O1xuXHRcdFx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0XHRcdC8vIEFzc2lnbiBzaW5nbGUgbG9jYXRpb25cblx0XHRcdFx0XHRcdFx0XHRzZWxmLmFuc3dlci5sb2NhdGlvbnMgPSBbc2VsZi5hbnN3ZXJzWzBdLmxvY2F0aW9uc1tzZWxmLmFuc3dlci5wZXJzb25JRCAtIDFdXTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcblx0XHRcdFx0XHRcdFx0aHRtbCA9XG5cdFx0XHRcdFx0XHRcdFx0cGVyc29uLm1vZGVsLmdldChcIm5hbWVcIikgK1xuXHRcdFx0XHRcdFx0XHRcdHNlbGYuYW5zd2Vyc1swXS5wYXJ0c1swXSArXG5cdFx0XHRcdFx0XHRcdFx0XCI8c3BhbiBjbGFzcz0naGlnaGxpZ2h0Jz5cIiArIG51bWJlcldpdGhDb21tYXMoZGF0YS5maXRuZXNzLnN1bW1hcnkuY2Fsb3JpZXNPdXQpICsgXCI8L3NwYW4+XCIgK1xuXHRcdFx0XHRcdFx0XHRcdHNlbGYuYW5zd2Vyc1swXS5wYXJ0c1sxXSArXG5cdFx0XHRcdFx0XHRcdFx0cGVyc29uLm1vZGVsLmdldChcImdvYWxzXCIpICtcblx0XHRcdFx0XHRcdFx0XHRzZWxmLmFuc3dlcnNbMF0ucGFydHNbMl0gK1xuXHRcdFx0XHRcdFx0XHRcdHJhbmRvbVJlc3BvbnNlXG5cdFx0XHRcdFx0XHRcdDtcblx0XHRcdFx0XHRcdFx0c2VsZi5hbnN3ZXIuaHRtbCA9IGh0bWw7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRzZWxmLmFuc3dlci5odG1sID0gXCI8cD5Tb3JyeSwgcGxlYXNlIHRyeSBhZ2Fpbi48L3A+XCI7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHNlbGYudGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7c2VsZi50cmlnZ2VyKFwiYW5zd2VyUmVhZHlcIik7fSwgMjUwMCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgMjpcblx0XHRcdFx0XHRzZWxmLmFuc3dlci5odG1sID0gc2VsZi5hbnN3ZXJzWzFdW3NlbGYuYW5zd2VyLnBlcnNvbklEIC0gMV0uaHRtbDtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHR2YXIgbG9jYXRpb25zID0gc2VsZi5hbnN3ZXJzWzFdW3NlbGYuYW5zd2VyLnBlcnNvbklEIC0gMV0ubG9jYXRpb25zO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vIEFkZCBsb2NhdGlvbiBuYW1lcyB0byBodG1sXG5cdFx0XHRcdFx0c2VsZi5hbnN3ZXIuaHRtbCArPSBcIjx1bD5cIjtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRmb3IodmFyIGkgPSAwOyBpIDwgbG9jYXRpb25zLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRzZWxmLmFuc3dlci5odG1sICs9IFwiPGxpPlwiICsgbG9jYXRpb25zW2ldLnRpdGxlICsgXCI8L2xpPlwiO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdFx0XHRzZWxmLmFuc3dlci5odG1sICs9IFwiPC91bD5cIjtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRzZWxmLmFuc3dlci5sb2NhdGlvbnMgPSBsb2NhdGlvbnM7XG5cdFx0XHRcdFx0c2VsZi50aW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtzZWxmLnRyaWdnZXIoXCJhbnN3ZXJSZWFkeVwiKTt9LCAzMDAwKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAzOlxuXHRcdFx0XHRcdHNlbGYuYW5zd2VyLmh0bWwgPSBzZWxmLmFuc3dlcnNbMl1bc2VsZi5hbnN3ZXIucGVyc29uSUQgLSAxXTtcblx0XHRcdFx0XHRzZWxmLnRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge3NlbGYudHJpZ2dlcihcImFuc3dlclJlYWR5XCIpO30sIDMwMDApO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBUbyBiZSBzZW50IHRvIEFQSVxuXHRcdFx0cmVxdWVzdERhdGEgPSB7XG5cdFx0XHRcdFwidXNlcklkXCI6IDEsIC8vIHNlbGYuYW5zd2VyLnBlcnNvbklELFxuXHRcdFx0XHRcInF1ZXN0aW9uXCI6IHtcblx0XHRcdFx0XHRcInF1ZXN0aW9uVGV4dFwiOiBxdWVzdGlvbi5tb2RlbC5nZXQoXCJ0ZXh0XCIpXG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRcblx0XHRcdC8vIEdldCB0aGUgYW5zd2VyXG5cdFx0XHRzZWxmLmpxeGhyID0gJC5hamF4KHtcblx0XHRcdFx0dXJsOiBjb25maWcudXJsLFxuXHRcdFx0XHRkYXRhOiByZXF1ZXN0RGF0YSxcblx0XHRcdFx0ZGF0YVR5cGU6IFwianNvbnBcIixcblx0XHRcdFx0dGltZW91dDogMTUwMDBcblx0XHRcdH0pLmFsd2F5cyhmdW5jdGlvbihkYXRhLCBzdGF0dXMsIGpxeGhyKSB7XG5cdFx0XHRcdGlmKHN0YXR1cyA9PSBcInN1Y2Nlc3NcIiAmJiBkYXRhLmFuc3dlci5hbnN3ZXJzWzBdKSB7XG5cdFx0XHRcdFx0aWYoc2VsZi5hbnN3ZXIucXVlc3Rpb25JRCA9PSA1ICYmIHNlbGYuYW5zd2VyLnBlcnNvbklEID09IDIpIHtcblx0XHRcdFx0XHRcdHNlbGYuYW5zd2VyLmh0bWwgKz0gc2VsZi5hbnN3ZXJzWzNdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdFx0XHRzZWxmLmFuc3dlci5odG1sICs9IGRhdGEuYW5zd2VyLmFuc3dlcnNbMF0uZm9ybWF0dGVkVGV4dDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzZWxmLmFuc3dlci5odG1sID0gXCI8cD5Tb3JyeSwgcGxlYXNlIHRyeSBhZ2Fpbi48L3A+XCI7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdHNlbGYudHJpZ2dlcihcImFuc3dlclJlYWR5XCIpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9LFxuXHRzaG93OiBmdW5jdGlvbigpIHtcblx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cdFx0XG5cdFx0Ly8gR3JhY2VmdWxseSBoaWRlIHNwaW5uZXJcblx0XHRzZWxmLiRlbC5yZW1vdmVDbGFzcyhcInNwaW5uZXJcIikuYWRkQ2xhc3MoXCJzcGluT3V0XCIpO1xuXHRcdFxuXHRcdGlmKHNlbGYuYW5zd2VyLmh0bWwpIHtcblx0XHRcdHNlbGYuJGVsLmFwcGVuZChcIjxtYWluPlwiICsgc2VsZi5hbnN3ZXIuaHRtbCArIFwiPC9tYWluPlwiKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c2VsZi4kZWwuYXBwZW5kKFwiPG1haW4+PHA+U29ycnksIHBsZWFzZSB0cnkgYWdhaW4gbGF0ZXIuPC9wPjwvbWFpbj5cIik7XG5cdFx0fVxuXHRcdFxuXHRcdC8vIFNob3cgZ2VuZXMgaWYgc29cblx0XHRpZihzZWxmLmFuc3dlci5nZW5lcykge1xuXHRcdFx0c2VsZi4kZWwuYWRkQ2xhc3MoXCJoYXMtZ2VuZXNcIik7XG5cdFx0XHRzZWxmLiRlbC5hcHBlbmQoc2VsZi5hbnN3ZXIuZ2VuZXMpO1xuXHRcdH1cblx0XHRcblx0XHQvLyBTaG93IG1hcCBpZiBsb2NhdGlvbnMgYXJlIGF2YWlsYWJsZVxuXHRcdGlmKHNlbGYuYW5zd2VyLmxvY2F0aW9ucykge1xuXHRcdFx0c2VsZi4kZWwuYWRkQ2xhc3MoXCJoYXMtbWFwXCIpO1xuXHRcdFx0c2VsZi4kZWwuYXBwZW5kKFwiPGRpdiBjbGFzcz0nY29udGFpbmVyJz48ZGl2IGlkPSdtYXAnPjwvZGl2PjwvZGl2PlwiKTtcblx0XHRcdFxuXHRcdFx0JC5nZXRKU09OKFwiL3NjcmlwdHMvanNvbi9tYXAuanNcIiwgZnVuY3Rpb24oc3R5bGVzKSB7XG5cdFx0XHRcdHZhciBzdHlsZWRNYXAgPSBuZXcgZ29vZ2xlLm1hcHMuU3R5bGVkTWFwVHlwZShcblx0XHRcdFx0XHRzdHlsZXMsXG5cdFx0XHRcdFx0e25hbWU6IFwiU3R5bGVkXCJ9XG5cdFx0XHRcdCk7XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgbWFwT3B0aW9ucyA9IHtcblx0XHRcdFx0XHRtYXBUeXBlQ29udHJvbE9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdG1hcFR5cGVJZHM6IFtnb29nbGUubWFwcy5NYXBUeXBlSWQuUk9BRE1BUCwgXCJtYXBfc3R5bGVcIl1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdG1hcFR5cGVDb250cm9sOiBmYWxzZSxcblx0XHRcdFx0XHRzdHJlZXRWaWV3Q29udHJvbDogZmFsc2UsXG5cdFx0XHRcdFx0em9vbUNvbnRyb2w6IHRydWUsXG5cdFx0XHRcdFx0em9vbUNvbnRyb2xPcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRzdHlsZTogZ29vZ2xlLm1hcHMuWm9vbUNvbnRyb2xTdHlsZS5MQVJHRSxcblx0XHRcdFx0XHRcdHBvc2l0aW9uOiBnb29nbGUubWFwcy5Db250cm9sUG9zaXRpb24uTEVGVF9UT1Bcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgbWFwID0gbmV3IGdvb2dsZS5tYXBzLk1hcChkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcIm1hcFwiKSwgbWFwT3B0aW9ucyk7XG5cdFx0XHRcdFxuXHRcdFx0XHRtYXAubWFwVHlwZXMuc2V0KFwibWFwX3N0eWxlXCIsIHN0eWxlZE1hcCk7XG5cdFx0XHRcdG1hcC5zZXRNYXBUeXBlSWQoXCJtYXBfc3R5bGVcIik7XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgYm91bmRzID0gbmV3IGdvb2dsZS5tYXBzLkxhdExuZ0JvdW5kcygpO1xuXHRcdFx0XHR2YXIgaW5mb3dpbmRvdyA9IG5ldyBnb29nbGUubWFwcy5JbmZvV2luZG93KCk7ICBcblx0XHRcdFx0XG5cdFx0XHRcdC8vIEFkZCBtYXJrZXJzXG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgc2VsZi5hbnN3ZXIubG9jYXRpb25zLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0Ly8gRm9ybWF0IHRpdGxlXG5cdFx0XHRcdFx0dmFyIGNvbnRlbnQgPSBcIlwiO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGlmKHNlbGYuYW5zd2VyLmxvY2F0aW9uc1tpXS50aXRsZSkge1xuXHRcdFx0XHRcdFx0Y29udGVudCA9IFwiPGRpdiBjbGFzcz0ndGl0bGUnPlwiICsgc2VsZi5hbnN3ZXIubG9jYXRpb25zW2ldLnRpdGxlICsgXCI8L2Rpdj5cIjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYoc2VsZi5hbnN3ZXIubG9jYXRpb25zW2ldLmRlc2NyaXB0aW9uKSB7XG5cdFx0XHRcdFx0XHRjb250ZW50ICs9IFwiPGRpdiBjbGFzcz0nZGVzY3JpcHRpb24nPlwiICsgc2VsZi5hbnN3ZXIubG9jYXRpb25zW2ldLmRlc2NyaXB0aW9uICsgXCI8L2Rpdj5cIjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0dmFyIG1hcmtlciA9IG5ldyBnb29nbGUubWFwcy5NYXJrZXIoe1xuXHRcdFx0XHRcdFx0cG9zaXRpb246IG5ldyBnb29nbGUubWFwcy5MYXRMbmcoXG5cdFx0XHRcdFx0XHRcdHNlbGYuYW5zd2VyLmxvY2F0aW9uc1tpXS5jb29yZGluYXRlcy5sYXR0aXR1ZGUsXG5cdFx0XHRcdFx0XHRcdHNlbGYuYW5zd2VyLmxvY2F0aW9uc1tpXS5jb29yZGluYXRlcy5sb25naXR1ZGVcblx0XHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0XHRtYXA6IG1hcCxcblx0XHRcdFx0XHRcdHRpdGxlOiBjb250ZW50LFxuXHRcdFx0XHRcdFx0dmlzaWJsZTogdHJ1ZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vZXh0ZW5kIHRoZSBib3VuZHMgdG8gaW5jbHVkZSBlYWNoIG1hcmtlcidzIHBvc2l0aW9uXG5cdFx0XHRcdFx0Ym91bmRzLmV4dGVuZChtYXJrZXIucG9zaXRpb24pO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGdvb2dsZS5tYXBzLmV2ZW50LmFkZExpc3RlbmVyKG1hcmtlciwgXCJjbGlja1wiLCAoZnVuY3Rpb24obWFya2VyLCBpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdGluZm93aW5kb3cuc2V0Q29udGVudChtYXJrZXIudGl0bGUpO1xuXHRcdFx0XHRcdFx0XHRpbmZvd2luZG93Lm9wZW4obWFwLCBtYXJrZXIpO1xuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9KShtYXJrZXIsIGkpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0bWFwLmZpdEJvdW5kcyhib3VuZHMpO1xuXG5cdFx0XHRcdC8vIFpvb20gb3V0IGZvciBzaW5nbGUgZGVzdGluYXRpb24gbWFwc1xuXHRcdFx0XHRpZihzZWxmLmFuc3dlci5sb2NhdGlvbnMubGVuZ3RoIDwgMikge1xuXHRcdFx0XHRcdHZhciBsaXN0ZW5lciA9IGdvb2dsZS5tYXBzLmV2ZW50LmFkZExpc3RlbmVyKG1hcCwgXCJpZGxlXCIsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdG1hcC5zZXRab29tKDExKTtcblx0XHRcdFx0XHRcdGdvb2dsZS5tYXBzLmV2ZW50LnJlbW92ZUxpc3RlbmVyKGxpc3RlbmVyKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gQWRkIGluIHRodW1icyB1cCBhbmQgZG93blxuXHRcdCQuZ2V0KFwiL3RlbXBsYXRlcy9jb252ZXJzYXRpb24vcmVzcG9uc2UvZm9vdGVyLmh0bWxcIiwgZnVuY3Rpb24oZGF0YSkge1xuXHRcdFx0c2VsZi4kZWwuYXBwZW5kKGRhdGEpO1xuXHRcdH0pO1xuXHR9LFxuXHRoaWRlOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cdFx0XG5cdFx0VHdlZW5NYXguZnJvbVRvKHNlbGYuJGVsLCAuNSwge29wYWNpdHk6IDF9LCB7XG5cdFx0XHRvcGFjaXR5OiAwLFxuXHRcdFx0ZGlzcGxheTogXCJub25lXCIsXG5cdFx0XHRvbkNvbXBsZXRlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0c2VsZi5zZXRUb0xvYWRpbmcoKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufSk7IiwiXCJ1c2Ugc3RyaWN0XCI7XG5tb2R1bGUuZXhwb3J0cyA9IEJhY2tib25lLlZpZXcuZXh0ZW5kKHtcblx0Y2xhc3NOYW1lOiBcInZpZXcgaGVsbG9cIixcblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdFxuXHRcdHNlbGYucmVuZGVyKCk7XG5cdFx0XG5cdFx0Ly8gQnV0dG9uIHRvIGVuZFxuXHRcdHNlbGYuJGVsLm9uZShcImNsaWNrXCIsIFwiYnV0dG9uXCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0c2VsZi50cmlnZ2VyKFwiZW5kXCIpO1xuXHRcdH0pO1xuXHR9LFxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBzZWxmID0gdGhpcztcblxuXHRcdHNlbGYuJGVsLmxvYWQoXCIvdGVtcGxhdGVzL2hlbGxvLmh0bWxcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHQvLyBTaWduYWwgdG8gcGFyZW50XG5cdFx0XHRzZWxmLnRyaWdnZXIoXCJsb2FkZWRcIik7XG5cdFx0fSk7XG5cdFx0XG5cdFx0cmV0dXJuIHNlbGY7XG5cdH1cbn0pOyIsIlwidXNlIHN0cmljdFwiO1xubW9kdWxlLmV4cG9ydHMgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG5cdGNsYXNzTmFtZTogXCJ2aWV3IGludHJvXCIsXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBzZWxmID0gdGhpcztcblx0XHRcblx0XHRzZWxmLnJlbmRlcigpO1xuXHRcdFxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7c2VsZi50cmlnZ2VyKFwiZW5kXCIpO30sIDcwMDApO1xuXHR9LFxuXHRyZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBzZWxmID0gdGhpcztcblxuXHRcdHNlbGYuJGVsLmxvYWQoXCIvdGVtcGxhdGVzL2ludHJvLmh0bWxcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHQvLyBTaWduYWwgdG8gcGFyZW50XG5cdFx0XHRzZWxmLnRyaWdnZXIoXCJsb2FkZWRcIik7XG5cdFx0fSk7XG5cdFx0XG5cdFx0cmV0dXJuIHNlbGY7XG5cdH1cbn0pOyIsIlwidXNlIHN0cmljdFwiO1xubW9kdWxlLmV4cG9ydHMgPSB7XG5cdHVybDogXCJodHRwOi8vXCIgKyB3aW5kb3cubG9jYXRpb24uaG9zdCArIFwiL2Fza1wiLFxuXHQvL3VybDogXCJodHRwOi8vYXRsZGV2LnBhdGh3YXkuY29tOjMwMDAvYXNrXCJcblx0Ly91cmw6IFwiaHR0cDovL29tZS1kZW1vLnBhdGh3YXkuY29tOjgwODAvYXNrXCIsXG59OyIsIlwidXNlIHN0cmljdFwiO1xudmFyIEFwcFZpZXcgPSByZXF1aXJlKFwiLi9hcHBcIik7XG5cbi8vXHRJbml0aWF0aW9uXG4kKHdpbmRvdykubG9hZChmdW5jdGlvbigpIHtcblx0Ly8gVGltZXIgY29kZVxuXHR2YXIgcmVzZXRUaW1lciA9IGZ1bmN0aW9uKHQpIHtcblx0XHRpZih0ID09PSAwKSB7XG5cdFx0XHRjbGVhclRpbWVvdXQodGltZXIpO1xuXHRcdH1cblx0XHRpZih0ID4gOTApIHtcblx0XHRcdC8vd2luZG93LmxvY2F0aW9uLnJlcGxhY2UoXCIvXCIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0Kys7XG5cdFx0XHR0aW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7cmVzZXRUaW1lcih0KTt9LCAxMDAwKTtcblx0XHR9XG5cdH07XG5cdFxuXHQvLyBTdGFydCB0aW1lclxuXHR2YXIgdGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge3Jlc2V0VGltZXIoMCk7fSwgMTAwMCk7XG5cdFxuXHQkKGRvY3VtZW50KS5vbihcInRvdWNoc3RhcnQgbW91c2Vkb3duXCIsIGZ1bmN0aW9uKGUpIHtcblx0XHQvLyBQcmV2ZW50IHNjcm9sbGluZyBvbiBhbnkgdG91Y2hlcyB0byBzY3JlZW5cblx0XHQkKHRoaXMpLnByZXZlbnRTY3JvbGxpbmcoZSk7XG5cdFx0XG5cdFx0Ly8gUmVzZXQgdGltZXJcblx0XHRyZXNldFRpbWVyKDApO1xuXHR9KTtcblx0XG5cdC8vIEZhc3QgY2xpY2tzIGZvciB0b3VjaCB1c2Vyc1xuXHRGYXN0Q2xpY2suYXR0YWNoKGRvY3VtZW50LmJvZHkpO1xuXHRcblx0Ly8gU3RhcnQhXG5cdHdpbmRvdy5hcHAgPSBuZXcgQXBwVmlldygpO1xufSk7Il19