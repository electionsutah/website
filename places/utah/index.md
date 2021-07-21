---
title: Utah County
permalink: "/places/utah/"
layout: page
comments: true
---

<nav class="content-nav">
  <a href="#2019-municipal-elections">2019</a>
  <a href="#2018-elections">2018</a>
  <a href="#2017-municipal-elections">2017</a>
</nav>

{% assign place = site.data.places.utah_county %}

<section class="info">
  <p><a href="{{ place.wikipedia_url }}">From Wikipedia:</a></p>
  <p class="citation">{{ place.wikipedia_snippet }}</p>
</section>

<div class="columns">
<ul>
  <li><a href="alpine">Alpine</a></li>
  <li><a href="american-fork">American Fork</a></li>
  <li><a href="cedar-fort">Cedar Fort</a></li>
  <li><a href="cedar-hills">Cedar Hills</a></li>
  <li><a href="eagle-mountain">Eagle Mountain</a></li>
  <li><a href="elk-ridge">Elk Ridge</a></li>
  <li><a href="fairfield">Fairfield</a></li>
  <li><a href="genola">Genola</a></li>
  <li><a href="goshen">Goshen</a></li>
  <li><a href="highland">Highland</a></li>
  <li><a href="lehi">Lehi</a></li>
  <li><a href="lindon">Lindon</a></li>
  <li><a href="mapleton">Mapleton</a></li>
  <li><a href="orem">Orem</a></li>
  <li><a href="payson">Payson</a></li>
  <li><a href="pleasant-grove">Pleasant Grove</a></li>
  <li><a href="provo">Provo</a></li>
  <li><a href="salem">Salem</a></li>
  <li><a href="santaquin">Santaquin</a></li>
  <li><a href="saratoga-springs">Saratoga Springs</a></li>
  <li><a href="spanish-fork">Spanish Fork</a></li>
  <li><a href="springville">Springville</a></li>
  <li><a href="vineyard">Vineyard</a></li>
  <li><a href="woodland-hills">Woodland Hills</a></li>
</ul>
</div>

### 2019 Municipal Elections

{% include 2019-municipal-elections.html %}

{% assign county = site.data.2019.candidates | where:'county','Utah' | sort:'last_name' %}
<table>
<thead>
  <th>First Names</th>
  <th>Last Names</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in county  %}
  <tr>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_names }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_names }}</a></td>
    <td><a href="{{ site.url }}/office/{{ member.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.office }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>

### 2018 Elections

{% include 2018-elections.html %}

#### 2018 Primary Candidates
{% assign county = site.data.2018.primary.candidates | where:'county','Utah' | sort:'last_name' %}
<table>
<thead>
  <th>First Names</th>
  <th>Last Names</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in county  %}
  <tr>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_names }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_names }}</a></td>
    <td><a href="{{ site.url }}/office/{{ member.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.office }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>

### 2017 Municipal Elections

{% include 2017-municipal-elections.html %}

{% assign county = site.data.2017.primary.candidates | where:'county','Utah' | sort:'last_name' %}
<table>
<thead>
  <th>First Names</th>
  <th>Last Names</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in county  %}
  <tr>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_names }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_names }}</a></td>
    <td><a href="{{ site.url }}/office/{{ member.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.office }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>