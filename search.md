---
layout: page
title: Search
permalink: /search/
comments: disable
---

<section id="search-results" style="display: none;"> </section>

{% raw %}
<script id="search-results-template" type="text/mustache">
  {{#entries}}
    <article>
      <h3>
        {{#date}}<small><time datetime="{{pubdate}}" pubdate>{{displaydate}}</time></small>{{/date}}
        <a href="{{url}}">{{title}}</a>
      </h3>
      {{#is_post}}
      <ul>
        {{#tags}}<li>{{.}} </li>{{/tags}}
      </ul>
      {{/is_post}}
    </article>
  {{/entries}}
</script>
{% endraw %}
