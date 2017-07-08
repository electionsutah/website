---
layout: page
title: Utah County
permalink: /places/utah/
comments: true
---

<!-- <section class="notice">
  <p>{{ site.data.places.utah_county.wikipedia_snippet }} (<a href="{{ site.data.places.utah_county.wikipedia_url }}"><span>Wikipedia</span></a>)</p>
</section> -->

<section class="notice">
<h3>Voter Registration Deadlines</h3>

<strong>For Municipal Primary Election August 15, 2017</strong>

<ul>
  <li>July 17, 2017 last day the County will accept mail-in voter registration forms for the Primary Election UCA 20A-2-102.5(2).</li>
  <li>July 31, 2017 last day the County Clerk can register voters in office and online for the Primary Election UCA 20A-2-201, 206.</li>
</ul>

<strong>For Municipal General Election November 7, 2017</strong>

<ul>
  <li>October 10, 2017 last day the County will accept mail-in voter registration forms for the General Election UCA 20A-2-102.5(2)</li>
  <li>October 23, 2017 last day the County Clerk can register voters in office or online UCA 20A-2-201, 206</li>
</ul>
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

### 2017 Primary Candidates
{% assign county = site.data.2017.primary.candidates | where:'county','Utah' | sort:'name' %}
<table>
<thead>
  <th>Name</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in county  %}
  <tr>
    <td><a href="../../people/{{member.id}}">{{member.name}}</a></td>
    <td>{{ member.body }}</td>
    <td><a href="../../places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="../../places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>
